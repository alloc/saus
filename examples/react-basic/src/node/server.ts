import etag from 'etag'
import fs from 'fs'
import http from 'http'
import { gray } from 'kleur/colors'
import { success } from 'misty'
import { MistyTask } from 'misty/task'
import { startTask } from 'misty/task'
import * as mime from 'mrmime'
import path from 'path'
import renderPage, {
  ClientModule,
  config,
  getKnownPaths,
  getModuleUrl,
  moduleMap,
  RenderPageOptions,
} from 'saus/bundle'
import { connect } from './connect'

const modules = new Map<string, ClientModule>(
  Object.values(moduleMap).map(module => [getModuleUrl(module), module])
)
const addModule = (module: ClientModule) => {
  const url = getModuleUrl(module)
  if (!modules.has(url)) {
    modules.set(url, module)
  }
}

const app = connect()
  .use((req, res, next) => {
    if (!req.url.startsWith(config.base)) {
      throw 404
    }
    const module = modules.get(req.url)
    if (!module) {
      return next()
    }
    console.log(gray('cached'), req.url)
    res.writeHead(200, {
      ETag: etag(module.text, { weak: true }),
      'Content-Type': mime.lookup(module.id)!,
    })
    res.write(module.text)
    return res.end()
  })
  .use(servePage)
  .use(servePublicDir('./', /\.(m?js|map)$/))
  .use(servePublicDir(config.publicDir))
  .on('error', (e, req, res, next) => {
    const close = (e: any) => {
      console.error(e)
      res.writeHead(500)
      res.end()
    }
    if (e == 404) {
      console.log(gray('unknown'), req.url)
      req.url = config.base + e
      servePage(req, res, next).catch(close)
    } else {
      close(e)
    }
  })

async function servePage(
  req: connect.Request,
  res: connect.Response,
  next: connect.NextFunction
) {
  try {
    const page = await renderPage(req.url)
    if (!page) {
      return next()
    }
    console.log(gray('rendered'), req.url)
    page.modules.forEach(addModule)
    page.assets.forEach(addModule)
    res.writeHead(200, {
      'Content-Type': 'text/html',
    })
    res.write(page.html)
    return res.end()
  } catch (error) {
    // Renderer threw an unexpected error.
    console.error(error)
    res.writeHead(500)
    res.end()
  }
}

function servePublicDir(publicDir: string, ignore = /^$/) {
  return async function servePublicFile(
    req: connect.Request,
    res: connect.Response,
    next: connect.NextFunction
  ) {
    const fileName = req.url.slice(config.base.length)
    if (ignore.test(fileName)) {
      return next()
    }
    try {
      const content = fs.readFileSync(path.join(publicDir, fileName))
      console.log(gray('read'), req.url)
      res.writeHead(200, {
        ETag: etag(content, { weak: true }),
        'Content-Type': mime.lookup(req.url) || 'application/octet-stream',
      })
      res.write(content)
      res.end()
    } catch (e: any) {
      if (e.code == 'ENOENT') {
        return next()
      }
      throw e
    }
  }
}

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
        page.modules.forEach(addModule)
        page.assets.forEach(addModule)
        addModule({
          id: page.id,
          text: page.html,
        })
      }
    },
  }
  const knownPaths = await getKnownPaths()
  await Promise.all(
    knownPaths.map(knownPath => {
      return renderPage(config.base + knownPath.slice(1), options)
    })
  )
  success(`${pageCount} pages were pre-cached.`)
}
