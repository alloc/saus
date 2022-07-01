import fs from 'fs'
import path from 'path'
import inlinedAssets from './inlinedAssets'
import { loadAsset, loadModule } from './loaders'
import type { PageBundle } from './types'

/**
 * Write an array of rendered pages to disk. Shared modules are deduplicated.
 *
 * Returns a map of file names to their size in kilobytes. This object can be
 * passed to the `printFiles` function.
 */
export async function writePages(
  pages: ReadonlyArray<PageBundle | null>,
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
      for (const moduleId of page.modules) {
        writeFile(path.join(outDir, moduleId), await loadModule(moduleId))
      }
      for (const assetId of page.assets) {
        writeFile(path.join(outDir, assetId), await loadAsset(assetId))
      }
    }
    for (const { id, data } of page.files) {
      writeFile(
        path.join(outDir, id),
        typeof data == 'string' ? data : Buffer.from(data.buffer)
      )
    }
  }

  // If a plugin uses the `emitFile` API, the asset won't exist in
  // the page's asset list, but it should still be written to disk.
  for (const assetId in inlinedAssets) {
    if (assetId in files) continue
    writeFile(
      path.join(outDir, assetId),
      Buffer.from(inlinedAssets[assetId], 'base64')
    )
  }

  return files
}
