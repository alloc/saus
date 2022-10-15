import { relative } from '@cush/relative'
import { MagicString } from '@utils/babel'
import { isExternalUrl } from '@utils/isExternalUrl'
import { limitTime } from '@utils/limitTime'
import { murmurHash } from '@utils/murmur3'
import { unwrapBuffer } from '@utils/node/buffer'
import createDebug from 'debug'
import fs from 'fs'
import { startTask } from 'misty/task'
import path from 'path'
import { get, Response } from '../http'
import { setup } from '../setup'
import { EnforcementPhase } from './process'
import { $ } from './selector'
import { traverseHtml } from './traversal'
import { HtmlDocument, HtmlVisitorState } from './types'

const debug = createDebug('saus:html:download')

type ContentPromise = Promise<string | Buffer>
type ReplicaListener = (replicaUrl: string) => void
type Replica = [queue: ReplicaListener[], fileName?: string, content?: any]
type File = [url: string, promise: ContentPromise, replica: Replica]

export type DownloadOptions = {
  timeout?: number
  enforce?: EnforcementPhase
  skip?: (url: string) => boolean
  onRequest?: (url: string) => void
  onResponse?: (url: string, response: Response) => void
  onWriteFile?: (fileName: string) => void
  /**
   * Override the default behavior of writing to the `outDir`.
   */
  writeFile?: (
    fileName: string,
    content: string | Buffer,
    state: HtmlVisitorState
  ) => Promise<void> | void
}

/**
 * Find any external assets referenced by each page's HTML and
 * download them to be self-hosted. This hook does nothing when
 * the `saus dev` command is used.
 */
export function downloadRemoteAssets(options?: DownloadOptions) {
  setup(env => env.command !== 'dev' && installHtmlHook(options))
}

function defaultWriteFile(fileName: string, content: string | Buffer) {
  fs.mkdirSync(path.dirname(fileName), { recursive: true })
  fs.writeFileSync(fileName, content)
}

function installHtmlHook({
  skip = () => false,
  onRequest,
  onResponse,
  onWriteFile,
  writeFile = defaultWriteFile,
  ...options
}: DownloadOptions = {}) {
  // Reuse `fetch` calls between pages.
  const requests: { [url: string]: Promise<Buffer> } = {}

  // Exists when writing is in progress.
  let schedule: ((entry: [string, File]) => void) | undefined

  const replicasByUrl = new Map<string, Replica>()
  const filesByDocument = new WeakMap<HtmlDocument, Map<string, File>>()

  function loadFile(
    url: string,
    document: HtmlDocument,
    fetch: (url: string, document: HtmlDocument) => ContentPromise,
    onLoad: (replicaUrl: string) => void
  ) {
    if (skip(url)) {
      return debug(`skipped asset: %O`, url)
    }

    let files = filesByDocument.get(document)
    if (!files) {
      files = new Map()
      filesByDocument.set(document, files)
    }

    const { config } = document.state

    const cachedReplica = replicasByUrl.get(url)
    if (cachedReplica) {
      const [listeners, fileName] = cachedReplica
      if (fileName) {
        onLoad(config.base + fileName)
      } else {
        listeners.push(onLoad)
      }
    } else {
      debug(`loading asset: %O`, url)
      const contentPromise = limitTime(
        fetch(url, document),
        options.timeout ?? 0,
        `Asset "${url}" is loading too slow`
      )

      const replica: Replica = [[onLoad]]
      replicasByUrl.set(url, replica)

      contentPromise.then(
        async content => {
          debug(`loaded asset: %O`, url)

          const fileType = path.extname(filePath)
          const contentHash = murmurHash(content)
          const fileName = path.posix.join(
            config.assetsDir,
            filePath.slice(1, -fileType.length) + `.${contentHash}${fileType}`
          )

          const replicaUrl = config.base + fileName
          replica[0].forEach(onLoad => onLoad(replicaUrl))
          replica[1] = fileName
          replica[2] = content
        },
        // Ignore unhandled rejections.
        () => {}
      )

      const file: File = [url, contentPromise, replica]
      const filePath = toFilePath(url)
      files.set(filePath, file)
      schedule?.([filePath, file])
    }
  }

  traverseHtml(options.enforce, [
    {
      html: {
        // Don't await file promises until the entire document is processed.
        // This allows other HTML manipulation to occur while downloading.
        async close(tag, state) {
          const files = filesByDocument.get(tag.document)
          if (!files || !files.size) {
            return
          }

          let numReplicated = 0
          async function replicate(entry: [string, File]) {
            const [, loading, replica] = entry[1]
            try {
              await loading
              const fileName = replica[1]!
              await writeFile(fileName, replica[2], state)
              onWriteFile?.(fileName)
              numReplicated += 1
            } catch (err) {
              console.error(err)
            }
          }

          const queue = Array.from(files)
          schedule = entry => queue.push(entry)

          while (queue.length) {
            const task = startTask(`Downloading ${queue.length} files...`)
            debug(`${queue.length} remote assets are being replicated`)
            const writing = Promise.all(queue.map(replicate))
            queue.length = 0
            await writing
            task.finish()
          }

          schedule = undefined
          debug(`${numReplicated} remote assets were saved for rehosting`)
        },
      },
    },
    $('script[src]', scriptTag => {
      const scriptUrl = scriptTag.attributes.src
      if (typeof scriptUrl == 'string' && isExternalUrl(scriptUrl)) {
        // Assume the script does not import anything.
        loadFile(scriptUrl, scriptTag.document, fetch, url => {
          scriptTag.setAttribute('src', url)
        })
      }
    }),
    $('link[rel="stylesheet"]', linkTag => {
      const cssUrl = linkTag.attributes.href
      if (typeof cssUrl == 'string' && isExternalUrl(cssUrl)) {
        loadFile(cssUrl, linkTag.document, fetchStyles, url => {
          linkTag.setAttribute('href', url)
        })
      }
    }),
  ])

  async function fetchStyles(cssUrl: string, document: HtmlDocument) {
    const cssText = await fetch(cssUrl)
    return replaceCssUrls(
      cssText.toString('utf8'),
      cssUrl,
      assetUrl =>
        new Promise<string>(setAssetUrl => {
          loadFile(assetUrl, document, fetch, setAssetUrl)
        })
    )
  }

  function fetch(url: string) {
    let request = requests[url]
    if (request) {
      return request
    }

    const download = (): Promise<Buffer> =>
      get(url, {
        headers: {
          // An explicit user agent ensures the most modern asset is cached.
          // In the future, we may want to send a duplicate request with an
          // antiquated user agent, so backwards compatibility is preserved.
          // This workaround is mostly relevant to Google Fonts, where "ttf"
          // fonts are served to browsers where "woff2" is not supported.
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:93.0) Gecko/20100101 Firefox/93.0',
        },
      }).then(
        resp => {
          onResponse?.(url, resp)
          return unwrapBuffer(resp.data)
        },
        err => {
          // Connection may reset when debugging.
          if (err.code == 'ECONNRESET') {
            return download()
          }
          throw err
        }
      )

    onRequest?.(url)
    request = requests[url] = download()
    return request
  }
}

declare const URL: typeof import('url').URL

function toFilePath(url: string) {
  let filePath = '/'

  const { host, pathname, searchParams } = new URL(url)
  if (host == 'www.googletagmanager.com') {
    filePath += `${host}/gtag.js`
  } else if (host == 'fonts.googleapis.com') {
    const [family] = searchParams.get('family')!.split(':')
    filePath += `${host}/${family}.css`
  } else {
    filePath += host + decodeURIComponent(pathname)
  }

  return filePath
}

async function replaceCssUrls(
  text: string,
  parentUrl: string,
  replacer: (url: string) => string | Promise<string>
) {
  const editor = new MagicString(text)
  const loading: Promise<void>[] = []
  const cssUrlRE = /url\(\s*('[^']+'|"[^"]+"|[^'")]+)\s*\)/g
  for (;;) {
    const match = cssUrlRE.exec(text)
    if (!match) {
      await Promise.allSettled(loading)
      return editor.toString()
    }
    let url = match[1]
    if (/^['"]/.test(url)) {
      url = url.slice(1, -1)
    }
    const prevUrl = url
    if (/^\.\.?\//.test(url)) {
      url = relative(parentUrl, url) || url
      debug(`resolve "${prevUrl}" to "${url}"`)
    } else if (!isExternalUrl(url)) {
      url = parentUrl.slice(0, parentUrl.lastIndexOf('/') + 1) + url
      debug(`resolve "${prevUrl}" to "${url}"`)
    }
    if (!isExternalUrl(url)) {
      continue
    }
    loading.push(
      Promise.resolve(replacer(url)).then(url => {
        editor.overwrite(
          match.index + 4,
          match.index + match[0].length - 1,
          JSON.stringify(url)
        )
      })
    )
  }
}
