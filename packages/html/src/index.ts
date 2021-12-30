import {
  EnforcedHandler,
  EnforcementPhase,
  findHtmlProcessor,
  processHtml,
} from 'saus/core'
import { kVisitorsArray } from './symbols'
import { bindVisitors, TraverseHtmlFn } from './traversal'
import { HtmlVisitor } from './types'

export { coerceVisitFn, HtmlTagPath } from './traversal'
export * from './resolver'
export * from './selector'
export * from './downloadRemoteAssets'
export * from './types'

type TraverseHtmlHook = EnforcedHandler<
  [visitor: HtmlVisitor] | [visitors: HtmlVisitor[]]
>

export const traverseHtml = ((arg, arg2) => {
  let enforce: EnforcementPhase | undefined
  if (!arg || typeof arg == 'string') {
    enforce = arg
    arg = arg2!
  }
  const traverse = findHtmlProcessor<TraverseHtmlFn>(
    enforce,
    p => kVisitorsArray in p
  )
  if (traverse) {
    const visitors = traverse[kVisitorsArray]
    if (Array.isArray(arg)) {
      arg.forEach(visitor => visitors.push(visitor))
    } else {
      visitors.push(arg)
    }
  } else {
    processHtml(enforce, bindVisitors(arg))
  }
}) as TraverseHtmlHook
