import http from 'http'
import { success } from 'misty'
import { MistyTask, startTask } from 'misty/task'
import createApp, {
  config,
  connect,
  createFileCache,
  getKnownPaths,
  PageBundleOptions,
  serveCachedFiles,
  servePages,
  servePublicDir,
} from 'saus/bundle'

const files = createFileCache(config.base)
const init = createApp()

const handler = connect(async () => {
  return {
    app: await init,
  }
})
  .use(serveCachedFiles(files))
  .use(servePages)
  .use(
    servePublicDir({
      root: './',
      include: /\.(m?js|map)$/,
    })
  )
  .use(servePublicDir())
  .on('error', (e, req, res, next) => {
    const close = (e: any) => {
      if (e) {
        console.error(e)
        res.writeHead(500)
        res.end()
      } else {
        next()
      }
    }
    if (e == 404) {
      req.url = config.base + e
      servePages(req, res, close)
    } else {
      close(e)
    }
  })

const port = Number(process.env.PORT || 8081)
http.createServer(handler).listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})

preCacheKnownPages()

async function preCacheKnownPages() {
  let pageCount = 0
  let tasks = new Map<string, MistyTask>()
  const options: PageBundleOptions = {
    renderStart(url) {
      tasks.set(url.path, startTask(`Rendering "${url}"`))
    },
    renderFinish(url, error, page) {
      tasks.get(url.path)!.finish()
      tasks.delete(url.path)
      if (error) {
        console.error(error.stack)
      } else if (!page) {
        console.warn(`[!] Page for "${url}" was null`)
      } else {
        pageCount++
        files.addFiles(page.files)
        files.addFile(page.id, page.html, {
          'content-type': 'text/html',
        })
      }
    },
  }
  const knownPaths = await getKnownPaths()
  const app = await init
  await Promise.all(
    knownPaths.map(knownPath => {
      return app.resolvePageBundle(knownPath, options)
    })
  )
  success(`${pageCount} pages were pre-cached.`)
}
