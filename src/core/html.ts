import { EnforcementPhase, HtmlResolver } from '../html'
import { HtmlVisitor } from '../html/traversal'

type HtmlVisitorTuple = readonly [EnforcementPhase | undefined, HtmlVisitor]

export type HtmlContext = {
  visitors: HtmlVisitorTuple[]
}

export let htmlContext: HtmlContext = null!
export const setHtmlContext = (ctx: HtmlContext | null) => (htmlContext = ctx!)
