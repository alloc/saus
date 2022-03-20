import fs from 'fs'
import { HttpRedirect } from '../http'
import inlinedAssets from './inlinedAssets'

type Promisable<T> = T | PromiseLike<T>

export interface AssetLoader {
  loadAsset(id: string): Promisable<Buffer | HttpRedirect>
}

export namespace AssetLoader {
  export interface Factory {
    (): AssetLoader
  }
}

// The default asset loader uses an inlined asset map (if given)
// or it loads from the filesystem.
export default (): AssetLoader => ({
  loadAsset(id) {
    let asset: string | Buffer = inlinedAssets[id]
    if (asset) {
      return Buffer.from(asset, 'base64')
    }
    // Assume the working directory is the `build.outDir` option.
    return fs.readFileSync(id)
  },
})
