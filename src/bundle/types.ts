import type { HttpRedirect } from '../http/redirect'
import type { ParsedUrl } from '../utils/url'

export interface PageBundleOptions {
  timeout?: number
  onError?: (error: Error & { url: string }) => null
  renderStart?: (url: ParsedUrl) => void
  renderFinish?: (
    url: ParsedUrl,
    error: Error | null,
    page?: PageBundle | null
  ) => void
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
