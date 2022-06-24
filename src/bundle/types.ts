import type { BufferLike } from '@/http'
import type { SourceMap } from '@/node/sourceMap'
import type { ClientModuleMap } from './runtime/bundle/types'

export * from './runtime/bundle/types'

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
  clientModules: ClientModuleMap
  /**
   * Assets loaded by the client.
   */
  clientAssets: Record<string, Buffer>
}
