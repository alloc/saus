import hasFlag from 'has-flag'
import http from 'http'
import { gray } from 'kleur/colors'
import { success } from 'misty'
import { MistyTask, startTask } from 'misty/task'
import renderPage, {
  config,
  getKnownPaths,
  RenderPageOptions,
} from 'saus/bundle'
import {
  createFileCache,
  serveCachedFiles,
  servePages,
  servePublicDir,
} from 'saus/core'
import { connect } from './connect'

const debug = !!process.env.DEBUG || hasFlag('debug') ? console.log : () => {}

const moduleCache = createFileCache(config.base)
const servePage = servePages(renderPage, moduleCache)
const serveModule = serveCachedFiles(moduleCache)

const app = connect()
  .use((req, res, next) => {
    if (!req.url.startsWith(config.base)) {
      throw 404
    }
    serveModule(req, res, next)
  })
  .use(servePage)
  .use(servePublicDir(config, './', /\.(m?js|map)$/))
  .use(servePublicDir(config))
  .on('error', (e, req, res, next) => {
    const close = (e: any) => {
      console.error(e)
      res.writeHead(500)
      res.end()
    }
    if (e == 404) {
      debug(gray('unknown'), req.url)
      req.url = config.base + e
      servePage(req, res, next).catch(close)
    } else {
      close(e)
    }
  })

const port = Number(process.env.PORT || 8081)
http.createServer(app).listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})

preCacheKnownPages()

async function preCacheKnownPages() {
  let pageCount = 0
  let tasks = new Map<string, MistyTask>()
  const options: RenderPageOptions = {
    renderStart(url) {
      tasks.set(url, startTask(`Rendering "${url}"`))
    },
    renderFinish(url, error, page) {
      tasks.get(url)!.finish()
      tasks.delete(url)
      if (error) {
        console.error(error.stack)
      } else if (!page) {
        console.warn(`[!] Page for "${url}" was null`)
      } else {
        pageCount++
        page.modules.forEach(moduleCache.add)
        page.assets.forEach(moduleCache.add)
        moduleCache.add({
          id: page.id,
          text: page.html,
        })
      }
    },
  }
  const knownPaths = await getKnownPaths()
  await Promise.all(
    knownPaths.map(knownPath => {
      return renderPage(knownPath, options)
    })
  )
  success(`${pageCount} pages were pre-cached.`)
}
