import { ClientModule } from '../bundle/types'
import type { RenderedPage } from '../pages/types'
import { reduceSerial } from '../utils/reduceSerial'
import { limitTime } from '../utils/limitTime'
import type { RuntimeConfig } from './config'
import { routesModule } from './global'

export type HtmlContext = {
  htmlProcessors?: HtmlProcessorMap
  processHtml?: MergedHtmlProcessor
}

export type HtmlProcessorState = {
  page: RenderedPage
  config: RuntimeConfig
  /**
   * Only exists in SSR bundle environment.
   *
   * By adding an asset URL to this `Set`, it will be loaded
   * or pre-fetched by the rendered page.
   */
  assets?: Set<string>
}

type Promisable<T> = T | PromiseLike<T>

export type HtmlPlugin<State = HtmlProcessorState> = {
  name: string
  process: HtmlProcessor<State>
}

export type HtmlProcessor<State = HtmlProcessorState> = (
  html: string,
  state: State
) => Promisable<string | null | void>

export type HtmlProcessorArray<State = HtmlProcessorState> = Array<
  HtmlPlugin<State> | HtmlProcessor<State>
>

export type HtmlProcessorMap<State = HtmlProcessorState> = {
  pre: HtmlProcessorArray<State>
  default: HtmlProcessorArray<State>
  post: HtmlProcessorArray<State>
}

const applyHtmlProcessor = <State>(
  html: string,
  plugin: HtmlPlugin<State> | HtmlProcessor<State>,
  state: State,
  timeout = 10
) =>
  typeof plugin == 'function'
    ? limitTime(plugin(html, state), timeout, `HTML processing took too long`)
    : limitTime(
        plugin.process(html, state),
        timeout,
        `HTML plugin "${plugin.name}" took too long`
      )

export function applyHtmlProcessors<State>(
  html: string,
  plugins: HtmlProcessorArray<State>,
  state: State,
  timeout?: number
) {
  if (!plugins.length) {
    return Promise.resolve(html)
  }
  return reduceSerial(
    plugins,
    (html, plugin) => applyHtmlProcessor(html, plugin, state, timeout),
    html
  )
}

export type MergedHtmlProcessor = (
  html: string,
  page: RenderedPage,
  timeout?: number
) => Promise<string>

export const mergeHtmlProcessors = <State>(
  htmlProcessors: HtmlProcessorMap<State> | undefined,
  getState: (page: RenderedPage) => State,
  phases: (keyof HtmlProcessorMap)[] = ['pre', 'default', 'post']
): MergedHtmlProcessor | undefined =>
  htmlProcessors &&
  (async (html, page, timeout) => {
    const state = getState(page)
    const processHtml = (html: string, plugin: any) =>
      applyHtmlProcessor(html, plugin, state, timeout)

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

export const findHtmlProcessor = <P extends HtmlProcessor | HtmlPlugin>(
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
  const plugins = routesModule.htmlProcessors[enforce || 'default']
  for (const plugin of Array.isArray(arg) ? arg : [arg]) {
    plugins.push(plugin)
  }
}) as EnforcedHandler<
  [plugin: HtmlPlugin | HtmlProcessor] | [plugins: HtmlProcessorArray]
>
