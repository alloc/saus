import fs from 'fs'
import * as mime from 'mrmime'
import path from 'path'
import { RenderedFile } from './app'
import { RuntimeConfig } from './config'

export interface ServePublicFileOptions {
  /** @default runtimeConfig.publicDir */
  root?: string
  /**
   * When defined, only files matching this can be served
   * by this middleware.
   */
  include?: RegExp
  /**
   * When defined, files matching this cannot be served
   * by this middleware.
   */
  ignore?: RegExp
}

export type PublicFile = RenderedFile & {
  data: Buffer
}

export function servePublicFile(
  url: string,
  runtimeConfig: RuntimeConfig,
  options?: ServePublicFileOptions
): PublicFile | null {
  const fileName = url.slice(runtimeConfig.base.length)
  if (options?.ignore?.test(fileName)) {
    return null
  }
  if (options?.include && !options.include.test(fileName)) {
    return null
  }
  try {
    const publicDir = options?.root || runtimeConfig.publicDir
    const content = fs.readFileSync(path.join(publicDir, fileName))
    return {
      id: fileName,
      data: content,
      get mime() {
        return mime.lookup(fileName) || 'application/octet-stream'
      },
    }
  } catch (e: any) {
    if (e.code == 'ENOENT' || e.code == 'EISDIR') {
      return null
    }
    throw e
  }
}
