export interface RenderedPage {
  html: string
  modules: ClientModule[]
}

export interface ClientModule {
  url: string
  file: string
  text: string
  imports?: string[]
  exports?: string[]
}

declare function renderPage(pageUrl: string): Promise<RenderedPage | null>

export default renderPage
