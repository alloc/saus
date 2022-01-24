import fs from 'fs'
import { blue, cyan, dim, gray, green, magenta, yellow } from 'kleur/colors'
import path from 'path'
import type { RenderedPage } from '../bundle/types'

export function writePages(
  pages: ReadonlyArray<RenderedPage | null>,
  outDir: string
) {
  const files: Record<string, number> = {}
  const writeFile = (file: string, content: string | Buffer) => {
    const name = path.relative(outDir, file)
    if (files[name] == null) {
      files[name] = content.length / 1024
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, content)
    }
  }
  for (const page of pages) {
    if (!page || !page.html) continue
    writeFile(path.join(outDir, page.id), page.html)
    for (const module of [...page.modules, ...page.assets]) {
      writeFile(path.join(outDir, module.id), module.text)
    }
    for (const { id, data } of page.files) {
      writeFile(
        path.join(outDir, id),
        typeof data == 'string' ? data : Buffer.from(data.buffer)
      )
    }
  }
  return files
}

type Color = typeof green

const writeColors: Record<string, Color> = {
  '.js': cyan,
  '.css': magenta,
  '.html': blue,
  '.map': gray,
}

export function printFiles(
  logger: { info(arg: string): void },
  files: Record<string, number>,
  outDir: string,
  chunkLimit = 500
) {
  if (!outDir.endsWith('/')) {
    outDir += '/'
  }
  const maxLength = Object.keys(files).reduce(
    (maxLength, file) => Math.max(maxLength, file.length),
    0
  )
  for (const [file, kibs] of Object.entries(files)) {
    const color = writeColors[path.extname(file)] || green
    const fileName = gray(outDir) + color(file.padEnd(maxLength + 2))
    const fileSize = (kibs > chunkLimit ? yellow : dim)(
      `${kibs.toFixed(2)} KiB`
    )
    logger.info(fileName + ' ' + fileSize)
  }
}
