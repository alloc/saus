import chalk from 'chalk'
import { startTask } from 'misty/task'
import fetch, { Response } from 'node-fetch'
import { traverseHtml } from '.'

export function downloadRemoteAssets() {
  traverseHtml({
    async 'link[rel="stylesheet"]'(path, state) {
      fetchStyles(path)
    },
    async 'script[src]'(path, state) {
      fetchScript(path)
    },
  })
}

function fetchStyles(cssRef: Element) {
  const cssUrl = cssRef.attr('href')
  if (cssUrl && isExternalUrl(cssUrl)) {
    const file = toFilePath(cssUrl)
    cssRef.attr('href', file)

    if (!this.has(file)) {
      debug(`found stylesheet: ${cssUrl}`)
      this.loaders[file] = () =>
        this.fetchText(cssUrl).then(cssText =>
          replaceCssUrls(cssText, cssUrl, url => {
            return this.fetchAsset(url)
          })
        )
    }
  }
}

function fetchScript(scriptRef: Element) {
  const scriptUrl = scriptRef.attr('src')
  if (scriptUrl && isExternalUrl(scriptUrl)) {
    const file = toFilePath(scriptUrl)
    scriptRef.attr('src', file)

    if (!this.has(file)) {
      debug(`found script: ${scriptUrl}`)
      this.loaders[file] = () => this.fetchText(scriptUrl)
    }
  }
}

function fetchAsset(assetUrl: string) {
  const file = toFilePath(assetUrl)
  if (!this.has(file)) {
    debug(`found asset: ${assetUrl}`)
    this.loaders[file] = () => this.fetchBuffer(assetUrl)
  }
  return this.toPublicUrl(file)
}

function fetchText(url: string) {
  return request(url).then(res => res.text())
}

function fetchBuffer(url: string) {
  return request(url).then(res => res.buffer())
}

const requests: { [url: string]: Promise<Response> } = {}

function request(url: string) {
  let request = requests[url]
  if (request) {
    return request
  }
  const task = startTask('Downloading ' + chalk.yellowBright(url))
  const download = (): Promise<Response> =>
    request(url, {
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

  request = this.requests[url] = download()
  return request.finally(() => {
    task.finish()
  })
}
