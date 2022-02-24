import { relative } from '@cush/relative'
import fs from 'fs'
import MagicString from 'magic-string'
import path from 'path'
import {
  EnforcementPhase,
  md5Hex,
  setup,
  unwrapBuffer,
  isExternalUrl,
  limitTime,
} from 'saus/core'
import { get, Response } from 'saus/http'
import { debug } from './debug'
import { HtmlTagPath } from './path'
import { $ } from './selector'
import { traverseHtml } from './traversal'
import { HtmlDocument, HtmlVisitorState } from './types'

type File = [FilePromise, ((url: string) => void)[], string]
type FilePromise = Promise<string | Buffer>

interface FileCache extends Map<string, File> {
  load(
    url: string,
    fetch: (url: string, files: FileCache) => FilePromise,
    onLoad: (newUrl: string) => void
  ): void
}

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

  // Exists once writing has begun.
  let scheduleWrite: ((entry: [string, File]) => void) | undefined

  const filesByDocument = new WeakMap<HtmlDocument, FileCache>()
  const getFiles = (tag: HtmlTagPath) => {
    let files = filesByDocument.get(tag.document)!
    if (!files) {
      files = new Map() as FileCache
      files.load = (url, fetch, onLoad) => {
        if (skip(url)) {
          return debug(`skipped asset: %O`, url)
        }
        const filePath = toFilePath(url)
        const listeners = files.get(filePath)?.[1]
        if (listeners) {
          listeners.push(onLoad)
        } else {
          debug(`loading asset: %O`, url)
          const loading = fetch(url, files)
          const file: File = [loading, [onLoad], url]
          scheduleWrite?.([filePath, file])
          files.set(filePath, file)
        }
      }
      filesByDocument.set(tag.document, files)
    }
    return files
  }

  traverseHtml(options.enforce, [
    {
      html: {
        // Don't await file promises until the entire document is processed.
        // This allows other HTML manipulation to occur while downloading.
        async close(tag, state) {
          const { config } = state

          let totalWritten = 0
          async function writeOnceLoaded(entry: [string, File]) {
            const [filePath, [loading, listeners, source]] = entry
            const ext = path.extname(filePath)
            try {
              const content = await limitTime(
                loading,
                options.timeout ?? 0,
                `Asset loading took too long: ${source}`
              )
              const contentHash = md5Hex(content).slice(0, 8)
              const fileName = path.posix.join(
                config.assetsDir,
                `${filePath.slice(1, -ext.length)}.${contentHash}${ext}`
              )

              const url = config.base + fileName
              listeners.forEach(onLoad => onLoad(url))

              await writeFile(fileName, content, state)
              onWriteFile?.(fileName)
              totalWritten += 1
            } catch (err) {
              console.error(err)
            }
          }

          const scheduledWrites = Array.from(getFiles(tag))
          scheduleWrite = entry => {
            scheduledWrites.push(entry)
          }

          while (scheduledWrites.length) {
            debug(
              `${scheduledWrites.length} remote assets are being replicated`
            )
            const writing = Promise.all(scheduledWrites.map(writeOnceLoaded))
            scheduledWrites.length = 0
            await writing
          }
          debug(`${totalWritten} remote assets were saved for rehosting`)
        },
      },
    },
    $('script[src]', scriptTag => {
      const scriptUrl = scriptTag.attributes.src
      if (typeof scriptUrl == 'string' && isExternalUrl(scriptUrl)) {
        const files = getFiles(scriptTag)
        // Assume the script does not import anything.
        files.load(scriptUrl, fetch, url => {
          scriptTag.setAttribute('src', url)
        })
      }
    }),
    $('link[rel="stylesheet"]', linkTag => {
      const cssUrl = linkTag.attributes.href
      if (typeof cssUrl == 'string' && isExternalUrl(cssUrl)) {
        const files = getFiles(linkTag)
        files.load(cssUrl, fetchStyles, url => {
          linkTag.setAttribute('href', url)
        })
      }
    }),
  ])

  async function fetchStyles(cssUrl: string, files: FileCache) {
    const cssText = await fetch(cssUrl)
    return replaceCssUrls(
      cssText.toString('utf8'),
      cssUrl,
      assetUrl =>
        new Promise<string>(setAssetUrl => {
          files.load(
            assetUrl,
            url =>
              limitTime(
                fetch(url),
                options.timeout ?? 0,
                `Asset "${assetUrl}" imported by "${cssUrl}" is loading too slow`
              ),
            setAssetUrl
          )
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
