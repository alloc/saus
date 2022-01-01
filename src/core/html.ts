import type { RenderedPage } from '../pages'
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

export function applyHtmlProcessors(
  html: string,
  state: HtmlProcessorState,
  processors: HtmlProcessor[]
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

export const mergeHtmlProcessors = (
  htmlProcessors: HtmlProcessorMap,
  config: RuntimeConfig,
  phases: (keyof HtmlProcessorMap)[] = ['pre', 'default', 'post']
) =>
  htmlProcessors &&
  (async (html: string, page: RenderedPage) => {
    const state: HtmlProcessorState = { page, config }
    const processHtml = (html: string, processor: HtmlProcessor) =>
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
