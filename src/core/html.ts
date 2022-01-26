import { ClientModule } from '../bundle/types'
import type { RenderedPage } from '../pages/types'
import { reduceSerial } from '../utils/reduceSerial'
import type { RuntimeConfig } from './config'
import { routesModule } from './global'

export type HtmlContext = {
  htmlProcessors?: HtmlProcessorMap
  processHtml?: (html: string, page: RenderedPage) => Promise<string>
}

export type HtmlProcessorState = Record<string, any> & {
  page: RenderedPage
  config: RuntimeConfig
  /**
   * Only exists in SSR bundle environment.
   *
   * If an HTML processor wants to provide self-hosted assets,
   * it should add the asset to this cache for the SSR bundle
   * to access, but make sure to also inject a `<link>` tag (or
   * whatever makes most sense for your use case) or else the
   * asset won't be loaded by the browser.
   */
  assets?: Set<ClientModule>
}

type Promisable<T> = T | PromiseLike<T>

export type HtmlProcessor<State = HtmlProcessorState> = (
  html: string,
  state: State
) => Promisable<string | null | void>

export type HtmlProcessorMap<State = HtmlProcessorState> = {
  pre: HtmlProcessor<State>[]
  default: HtmlProcessor<State>[]
  post: HtmlProcessor<State>[]
}

export function applyHtmlProcessors<State>(
  html: string,
  state: State,
  processors: HtmlProcessor<State>[]
) {
  if (!processors.length) {
    return Promise.resolve(html)
  }
  return reduceSerial(
    processors,
    (html, processor) => processor(html, state),
    html
  )
}

export const mergeHtmlProcessors = <State>(
  htmlProcessors: HtmlProcessorMap<State>,
  getState: (page: RenderedPage) => State,
  phases: (keyof HtmlProcessorMap)[] = ['pre', 'default', 'post']
) =>
  htmlProcessors &&
  (async (html: string, page: RenderedPage) => {
    const state = getState(page)
    const processHtml = (html: string, processor: HtmlProcessor<State>) =>
      processor(html, state)

    for (const phase of phases) {
      html = await reduceSerial(htmlProcessors[phase], processHtml, html)
    }

    return html
  })

export type EnforcementPhase = 'pre' | 'post'

export interface EnforcedHandler<Args extends any[]> {
  (...args: Args): void
  (enforce: EnforcementPhase | undefined, ...args: Args): void
}

export const findHtmlProcessor = <P extends HtmlProcessor>(
  enforce: EnforcementPhase | undefined,
  match: (processor: P) => boolean
): P | undefined =>
  routesModule.htmlProcessors?.[enforce || 'default'].find(match as any)

export const processHtml = ((arg, arg2) => {
  let enforce: EnforcementPhase | undefined
  if (!arg || typeof arg == 'string') {
    enforce = arg
    arg = arg2!
  }
  routesModule.htmlProcessors ??= { pre: [], default: [], post: [] }
  const processors = routesModule.htmlProcessors[enforce || 'default']
  for (const processor of Array.isArray(arg) ? arg : [arg]) {
    processors.push(processor)
  }
}) as EnforcedHandler<
  [processor: HtmlProcessor] | [processors: HtmlProcessor[]]
>
