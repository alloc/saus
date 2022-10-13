import type { BufferLike } from '@runtime/http'
import type { SourceMap } from '@utils/node/sourceMap'

export * from '@runtime/bundleTypes'
export type { BuildContext, BundleContext, InlineBundleConfig } from './context'
export type { BundleOptions } from './options'

export type ClientChunk = {
  fileName: string
  code: string
  isEntry: boolean
} & (
  | { isDebug: true; modules?: undefined }
  | { isDebug?: false; modules: Record<string, unknown> }
)

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
   * The `appVersion` string when the bundle was generated.
   */
  appVersion?: string
  /**
   * The client runtime and any user code; split into "chunks"
   * so that routes only load what they use.
   */
  clientChunks: ClientChunk[]
  /**
   * Assets loaded by the client.
   */
  clientAssets: ClientAsset[]
  /**
   * The entry module for each route.
   */
  routeEntries: Record<string, string>
}
