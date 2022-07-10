import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { OutputBundle } from '../bundle/types'
import { unwrapBuffer } from './node/buffer'

export function writeBundle(
  bundle: OutputBundle,
  outDir: string,
  options: {
    writeAssets?: boolean
    writeIndexTypes?: boolean
  } = {}
) {
  assert(bundle.path)

  fs.mkdirSync(path.dirname(bundle.path), { recursive: true })
  if (bundle.map) {
    fs.writeFileSync(bundle.path + '.map', JSON.stringify(bundle.map))
    bundle.code +=
      '\n//# ' + 'sourceMappingURL=' + path.basename(bundle.path) + '.map'
  }

  fs.writeFileSync(bundle.path, bundle.code)
  if (options.writeIndexTypes) {
    fs.copyFileSync(
      path.resolve(__dirname, '../bundle/index.d.ts'),
      bundle.path.replace(/(\.[cm]js)?$/, '.d.ts')
    )
  }

  for (let [file, buffer] of Object.entries(bundle.files)) {
    file = path.resolve(outDir, file)
    fs.writeFileSync(file, unwrapBuffer(buffer))
  }

  if (options.writeAssets) {
    let file: string
    for (const chunk of bundle.clientChunks) {
      file = path.join(outDir, chunk.fileName)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, chunk.code)
    }
    for (const asset of bundle.clientAssets) {
      file = path.join(outDir, asset.fileName)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, asset.source)
    }
  }
}
