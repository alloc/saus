import fs from 'fs'
import etag from 'etag'
import http from 'http'
import path from 'path'
import mime from 'mime/lite'
import renderPage, { ClientModule } from 'saus/bundle'

const modules = new Map<string, ClientModule>()
const publicDir = path.resolve(__dirname, '../../public')

const server = http.createServer(async (req, res) => {
  const url = req.url!
  const module = modules.get(url)
  if (module) {
    res.writeHead(200, {
      ETag: etag(module.text, { weak: true }),
      'Content-Type': mime.getType(url)!,
    })
    res.write(module.text)
    return res.end()
  }

  try {
    const page = await renderPage(url)
    if (page) {
      for (const module of page.modules) {
        modules.set(module.url, module)
      }
      res.writeHead(200, {
        'Content-Type': 'text/html',
      })
      res.write(page.html)
      return res.end()
    }
  } catch (error) {
    console.error(error)
    res.writeHead(500)
    res.end()
  }

  try {
    const publicFile = fs.readFileSync(path.join(publicDir, url))
    res.writeHead(200, {
      ETag: etag(publicFile, { weak: true }),
      'Content-Type': mime.getType(url) || 'application/octet-stream',
    })
    res.write(publicFile)
    res.end()
  } catch {
    res.writeHead(404)
    res.end()
  }
})

const port = Number(process.env.PORT || 8081)
server.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})
