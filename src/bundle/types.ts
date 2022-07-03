import type { BufferLike } from '@/http'
import type { SourceMap } from '@/node/sourceMap'

export * from './runtime/bundle/types'

export type ClientModule = {
  fileName: string
  code: string
  isDebug?: boolean
}

export type ClientAsset = {
  fileName: string
  source: string | Uint8Array
}

/**
 * The bundle object produced by the `bundle` function.
 */
export interface OutputBundle {
  /** Where the bundle is saved to disk. */
  path: string | undefined
  /** This code generates and serves the application. */
  code: string
  /** The collapsed sourcemap for this bundle. */
  map: SourceMap | undefined
  /**
   * These files are written to the `build.outDir` directory, but
   * only if the bundle has a defined `path`. More files can be
   * added by plugins in the `saus.receiveBundle` hook.
   */
  files: Record<string, BufferLike>
  /**
   * The client runtime and any user code; split into "chunks"
   * so that routes only load what they use.
   */
  clientModules: ClientModule[]
  /**
   * Assets loaded by the client.
   */
  clientAssets: ClientAsset[]
}
