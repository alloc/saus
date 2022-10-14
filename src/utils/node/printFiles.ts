import { blue, cyan, dim, gray, green, magenta, yellow } from 'kleur/colors'
import path from 'path'

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
  debugBase?: string
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
