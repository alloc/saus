import { traverse } from '../html/traversal'
import type {
  EnforcementPhase,
  HtmlVisitor,
  HtmlVisitorState,
} from '../html/types'
import type { RenderedPage } from '../pages'
import { routesModule } from './global'

export type HtmlContext = {
  visitors?: HtmlVisitorMap
  transformHtml?: (html: string, page: RenderedPage) => string | Promise<string>
}

export type HtmlVisitorMap = {
  pre: HtmlVisitor[]
  default: HtmlVisitor[]
  post: HtmlVisitor[]
}

export function addHtmlVisitor(
  visitor: HtmlVisitor,
  enforce?: EnforcementPhase
) {
  routesModule.visitors ??= { pre: [], default: [], post: [] }
  routesModule.visitors[enforce || 'default'].push(visitor)
}

export async function transformHtml(
  html: string,
  state: HtmlVisitorState,
  visitors: HtmlVisitorMap
) {
  html = await traverse(html, state, visitors.pre)
  html = await traverse(html, state, visitors.default)
  html = await traverse(html, state, visitors.post)
  return html
}
