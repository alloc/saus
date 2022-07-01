import type { RenderedPage, RenderPageOptions } from '@/app/types'
import type { ParsedUrl } from '@/node/url'

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
  /** Modules used by the client. */
  modules: string[]
  /** Assets used by the client. */
  assets: string[]
}

export interface RenderedFile {
  id: string
  data: any
  mime: string
}

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
