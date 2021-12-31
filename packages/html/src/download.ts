import { relative } from '@cush/relative'
import fs from 'fs'
import MagicString from 'magic-string'
import fetch, { Response } from 'node-fetch'
import path from 'path'
import { EnforcementPhase, md5Hex } from 'saus/core'
import urlRegex from 'url-regex'
import { debug } from './debug'
import { HtmlTagPath } from './path'
import { $ } from './selector'
import { traverseHtml } from './traversal'
import { HtmlDocument } from './types'

type File = [FilePromise, ((url: string) => void)[]]
type FilePromise = Promise<string | Buffer>

interface FileCache extends Map<string, File> {
  load(
    url: string,
    fetch: (url: string, files: FileCache) => FilePromise,
    onLoad: (newUrl: string) => void
  ): void
}

type DownloadOptions = {
  enforce?: EnforcementPhase
  onRequest?: (url: string) => void
  onResponse?: (url: string, content: string | Buffer) => void
}

export function downloadRemoteAssets({
  onRequest,
  onResponse,
  ...options
}: DownloadOptions = {}) {
  // Reuse `fetch` calls between pages.
  const requests: { [url: string]: Promise<Response> } = {}

  const filesByDocument = new WeakMap<HtmlDocument, FileCache>()
  const getFiles = (tag: HtmlTagPath) => {
    let files = filesByDocument.get(tag.document)!
    if (!files) {
      files = new Map() as FileCache
      files.load = (url, fetch, onLoad) => {
        const file = toFilePath(url)
        const listeners = files.get(file)?.[1]
        if (listeners) {
          listeners.push(onLoad)
        } else {
          debug(`loading file: ${url}`)
          onRequest?.(url)
          const loading = fetch(url, files)
          if (onResponse) {
            loading.then(content => {
              onResponse(url, content)
            })
          }
          files.set(file, [loading, [onLoad]])
        }
      }
      filesByDocument.set(tag.document, files)
    }
    return files
  }

  traverseHtml(options.enforce, [
    {
      html: {
        async close(tag, { config }) {
          // Don't await file promises until the entire document is processed.
          // This allows other HTML manipulation to occur while downloading.
          await Promise.all(
            Array.from(getFiles(tag), async ([file, [loading, listeners]]) => {
              const ext = path.extname(file)
              const content = await loading
              const contentHash = md5Hex(content).slice(0, 8)
              const fileName = path.posix.join(
                config.assetsDir,
                `${file.slice(1, -ext.length)}.${contentHash}${ext}`
              )
              const url = config.base + fileName
              listeners.forEach(onLoad => onLoad(url))
              fs.writeFileSync(fileName, content)
            })
          )
        },
      },
    },
    $('script[src]', (scriptTag, { config }) => {
      const scriptUrl = scriptTag.attributes.src
      if (typeof scriptUrl == 'string' && isRemoteAsset(scriptUrl)) {
        const files = getFiles(scriptTag)
        files.load(scriptUrl, fetchText, url =>
          scriptTag.setAttribute('src', url)
        )
      }
    }),
    $('link[rel="stylesheet"]', linkTag => {
      const cssUrl = linkTag.attributes.href
      if (typeof cssUrl == 'string' && isRemoteAsset(cssUrl)) {
        const files = getFiles(linkTag)
        files.load(cssUrl, fetchStyles, url =>
          linkTag.setAttribute('href', url)
        )
      }
    }),
  ])

  function fetchStyles(cssUrl: string, files: FileCache) {
    return fetchText(cssUrl).then(cssText =>
      replaceCssUrls(
        cssText,
        cssUrl,
        assetUrl =>
          new Promise<string>(setAssetUrl => {
            files.load(assetUrl, fetchBuffer, setAssetUrl)
          })
      )
    )
  }

  function fetchText(url: string) {
    return get(url).then(res => res.text())
  }

  function fetchBuffer(url: string) {
    return get(url).then(res => res.buffer())
  }

  function get(url: string) {
    let request = requests[url]
    if (request) {
      return request
    }
    const download = (): Promise<Response> =>
      fetch(url, {
        headers: {
          // An explicit user agent ensures the most modern asset is cached.
          // In the future, we may want to send a duplicate request with an
          // antiquated user agent, so backwards compatibility is preserved.
          // This workaround is mostly relevant to Google Fonts, where "ttf"
          // fonts are served to browsers where "woff2" is not supported.
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:93.0) Gecko/20100101 Firefox/93.0',
        },
      }).catch(err => {
        // Connection may reset when debugging.
        if (err.code == 'ECONNRESET') {
          return download()
        }
        throw err
      })

    request = requests[url] = download()
    return request
  }
}

function isRemoteAsset(url: string) {
  return urlRegex().test(url)
}

function toFilePath(url: string) {
  let file = '/'

  const { host, pathname, searchParams } = new URL(url)
  if (host == 'www.googletagmanager.com') {
    file += `${host}/gtag.js`
  } else if (host == 'fonts.googleapis.com') {
    const [family] = searchParams.get('family')!.split(':')
    file += `${host}/${family}.css`
  } else {
    file += host + decodeURIComponent(pathname)
  }

  return file
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
      await Promise.all(loading)
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
    } else if (!isRemoteAsset(url)) {
      url = parentUrl.slice(0, parentUrl.lastIndexOf('/') + 1) + url
      debug(`resolve "${prevUrl}" to "${url}"`)
    }
    if (isRemoteAsset(url))
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
