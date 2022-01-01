import fs from 'fs'
import etag from 'etag'
import http from 'http'
import path from 'path'
import * as mime from 'mrmime'
import { gray } from 'kleur/colors'
import { getPageFilename } from 'saus'
import renderPage, { config, getModuleUrl, ClientModule } from 'saus/bundle'
import knownPaths from 'saus/paths'
import { connect } from './connect'
import './html'

const modules = new Map<string, ClientModule>()
const publicDir = new URL('../../public', import.meta.url).pathname

function addModule(module: ClientModule) {
  const url = getModuleUrl(module)
  if (!modules.has(url)) {
    modules.set(url, module)
  }
}

// Pre-render all known pages.
for (let knownPath of knownPaths) {
  const page = await renderPage(config.base + knownPath.slice(1))
  if (!page) {
    console.warn(`[!] Page for "${knownPath}" was null`)
    continue
  }
  page.modules.forEach(addModule)
  addModule({
    id: getPageFilename(knownPath),
    text: page.html,
  })
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
      'Content-Type': mime.lookup(req.url)!,
    })
    res.write(module.text)
    return res.end()
  })
  .use(servePage)
  .use(servePublicFile)
  .on('error', (e, req, res, next) => {
    const close = (e: any) => {
      console.error(e)
      res.writeHead(500)
      res.end()
    }
    if (e == 404) {
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

async function servePublicFile(
  req: connect.Request,
  res: connect.Response,
  next: connect.NextFunction
) {
  try {
    const publicFile = fs.readFileSync(path.join(publicDir, req.url))
    console.log(gray('read'), req.url)
    res.writeHead(200, {
      ETag: etag(publicFile, { weak: true }),
      'Content-Type': mime.lookup(req.url) || 'application/octet-stream',
    })
    res.write(publicFile)
    res.end()
  } catch {
    throw 404
  }
}

const port = Number(process.env.PORT || 8081)
http.createServer(app).listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})
