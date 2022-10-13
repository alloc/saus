import type { PageBundle } from '@runtime/bundleTypes'
import fs from 'fs'
import path from 'path'
import clientAssets from './clientAssets'
import clientModules from './clientModules'
import { loadAsset, loadModule } from './clientStore'

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
    }
    for (const { id, data } of page.files) {
      writeFile(
        path.join(outDir, id),
        typeof data == 'string' ? data : Buffer.from(data.buffer)
      )
    }
  }

  for (const moduleId in clientModules) {
    writeFile(path.join(outDir, moduleId), await loadModule(moduleId))
  }
  for (const assetId in clientAssets) {
    writeFile(path.join(outDir, assetId), await loadAsset(assetId))
  }

  return files
}
