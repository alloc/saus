import { HttpRedirect } from '@/http'
import fs from 'fs'
import path from 'path'
import type { PageBundle } from './types'

/**
 * Write an array of rendered pages to disk. Shared modules are deduplicated.
 *
 * Returns a map of file names to their size in kilobytes. This object can be
 * passed to the `printFiles` function.
 */
export function writePages(
  pages: ReadonlyArray<PageBundle | null>,
  outDir: string,
  inlinedAssets?: Record<string, string>
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
      for (const module of page.modules) {
        writeFile(path.join(outDir, module.id), module.text)
      }
      for (const [assetId, content] of page.assets) {
        if (!(content instanceof HttpRedirect)) {
          writeFile(path.join(outDir, assetId), Buffer.from(content))
        }
      }
    }
    for (const { id, data } of page.files) {
      writeFile(
        path.join(outDir, id),
        typeof data == 'string' ? data : Buffer.from(data.buffer)
      )
    }
  }

  if (inlinedAssets)
    for (const assetId in inlinedAssets) {
      if (assetId in files) continue
      writeFile(
        path.join(outDir, assetId),
        Buffer.from(inlinedAssets[assetId], 'base64')
      )
    }

  return files
}
