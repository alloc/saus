import type { RuntimeConfig } from '../bundle/runtime/config'
import type { RenderedPage } from '../pages'
import { reduceSerial } from '../utils/reduceSerial'
import { routesModule } from './global'

export type HtmlContext = {
  htmlProcessors?: HtmlProcessorMap
  processHtml?: (html: string, page: RenderedPage) => Promise<string>
}

export type HtmlProcessorState = Record<string, any> & {
  page: RenderedPage
  config: RuntimeConfig
}

type Promisable<T> = T | PromiseLike<T>

export type HtmlProcessor = (
  html: string,
  state: HtmlProcessorState
) => Promisable<string | null | void>

export type HtmlProcessorMap = {
  pre: HtmlProcessor[]
  default: HtmlProcessor[]
  post: HtmlProcessor[]
}

export const mergeHtmlProcessors = (
  htmlProcessors: HtmlProcessorMap,
  config: RuntimeConfig
) =>
  htmlProcessors &&
  (async (html: string, page: RenderedPage) => {
    const state: HtmlProcessorState = { page, config }
    const processHtml = (html: string, processor: HtmlProcessor) =>
      processor(html, state)

    html = await reduceSerial(htmlProcessors.pre, processHtml, html)
    html = await reduceSerial(htmlProcessors.default, processHtml, html)
    html = await reduceSerial(htmlProcessors.post, processHtml, html)

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
