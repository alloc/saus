import type { RenderedFile, RenderedPage, RenderPageOptions } from './app/types'
import type { ParsedUrl } from './url'

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
}
