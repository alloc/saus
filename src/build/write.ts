import fs from 'fs'
import { blue, cyan, dim, gray, green, magenta, yellow } from 'kleur/colors'
import path from 'path'
import type { RenderedPage } from '../bundle/types'
import runtimeConfig from '../core/runtimeConfig'

/**
 * Write an array of rendered pages to disk. Shared modules are deduplicated.
 *
 * Returns a map of file names to their size in kilobytes. This object can be
 * passed to the `printFiles` function.
 */
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
    if (!page) continue
    if (page.html) {
      writeFile(path.join(outDir, page.id), page.html)
      for (const module of [...page.modules, ...page.assets]) {
        writeFile(path.join(outDir, module.id), module.text)
      }
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

/**
 * Print a bunch of files kind of like Vite does.
 *
 * @param logger The object responsible for printing
 * @param files File names (relative to the `outDir`) mapped to their size in kilobytes
 * @param outDir The directory (relative to your project root) where all given files reside
 * @param sizeLimit Highlight files larger than the given number of kilobytes (default: `500`)
 */
export function printFiles(
  logger: { info(arg: string): void },
  files: Record<string, number>,
  outDir: string,
  chunkLimit = 500,
  debugBase = runtimeConfig.debugBase
) {
  if (!outDir.endsWith('/')) {
    outDir += '/'
  }

  let printedFiles = Object.keys(files)
  if (debugBase)
    printedFiles = printedFiles.filter(
      file => !file.startsWith(debugBase.slice(1))
    )

  const maxLength = printedFiles.reduce(
    (maxLength, file) => Math.max(maxLength, file.length),
    0
  )

  for (const file of printedFiles) {
    const kibs = files[file]
    const color = writeColors[path.extname(file)] || green
    const fileName = gray(outDir) + color(file.padEnd(maxLength + 2))
    const fileSize = (kibs > chunkLimit ? yellow : dim)(
      `${kibs.toFixed(2)} KiB`
    )
    logger.info(fileName + ' ' + fileSize)
  }
}
