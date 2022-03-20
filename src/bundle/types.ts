import { HttpRedirect } from '../http/redirect'

export type RenderedFile = {
  id: string
  data: any
  mime: string
}

export interface RenderedPage {
  id: string
  html: string
  /** Files generated whilst rendering. */
  files: RenderedFile[]
  /** Modules required by the client. */
  modules: Set<ClientModule>
  /** Assets required by the client. */
  assets: Map<string, ClientAsset>
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

export type RenderPageOptions = {
  timeout?: number
  renderStart?: (url: string) => void
  renderFinish?: (
    url: string,
    error: Error | null,
    page?: RenderedPage | null
  ) => void
}
