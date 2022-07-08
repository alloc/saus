import { PublicDirMode } from '@/publicDir'

export interface BundleOptions {
  absoluteSources?: boolean
  isBuild?: boolean
  forceWriteAssets?: boolean
  minify?: boolean
  preferExternal?: boolean
  appVersion?: string
  /**
   * Control how the `publicDir` is handled.
   *
   * - `write` \
   *   Write files in `publicDir` into the `build.outDir` directory. \
   *   This is the default value when `copyPublicDir` plugin is used.
   * - `cache` \
   *   Skip writing but still cache the public files in memory for use
   *   by other plugins.
   * - `skip` \
   *   Skip writing, scanning, and transformation of public files. \
   *   This is always used when `copyPublicDir` plugin is missing.
   */
  publicDirMode?: PublicDirMode
  onPublicFile?: (name: string, data: Buffer) => void
}
