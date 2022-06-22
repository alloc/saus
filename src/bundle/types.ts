import type { BufferLike, RenderedPage, RenderPageOptions } from '../app/types'
import type { HttpRedirect } from '../http/redirect'
import type { SourceMap } from '../utils/sourceMap'
import type { ParsedUrl } from '../utils/url'

export type PublicDirMode = 'write' | 'cache' | 'skip'

export interface PageBundleOptions
  extends Pick<RenderPageOptions, 'timeout' | 'onError'> {
  renderStart?: (url: ParsedUrl) => void
  renderFinish?: (
    url: ParsedUrl,
    error: Error | null,
    page?: PageBundle | null
  ) => void
  /** @internal */
  receivePage?: (page: RenderedPage | null, error: any) => void
}

export interface PageBundle {
  id: string
  html: string
  /** Files generated whilst rendering. */
  files: RenderedFile[]
  /** Modules required by the client. */
  modules: Set<ClientModule>
  /** Assets required by the client. */
  assets: Map<string, ClientAsset>
}

export interface RenderedFile {
  id: string
  data: any
  mime: string
}

export type ClientAsset = ArrayBufferLike | HttpRedirect

export interface ClientModule {
  id: string
  text: string
  debugText?: string
  imports?: string[]
  exports?: string[]
}

/**
 * For entry chunks, keys are import statements.
 * For vendor chunks, keys are generated file names.
 * For route chunks, keys are dev URLs.
 */
export interface ClientModuleMap {
  [key: string]: ClientModule
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
  clientModules: ClientModuleMap
  /**
   * Assets loaded by the client.
   */
  clientAssets: Record<string, Buffer>
}
