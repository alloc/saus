import type { RenderedPage, RenderPageOptions } from '@/app/types'
import type { ParsedUrl } from '@/node/url'

export * from '@/app/types'

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

export interface RenderedFile {
  id: string
  data: any
  mime: string
}
