import {
  EnforcedHandler,
  EnforcementPhase,
  findHtmlProcessor,
  processHtml,
} from 'saus/core'
import { kVisitorsArray } from './symbols'
import { HtmlVisitor } from './types'
import { bindVisitors, TraverseVisitor } from './visitors/bind'

type TraverseHtmlHook = EnforcedHandler<
  [visitor: HtmlVisitor] | [visitors: HtmlVisitor[]]
>

/**
 * Hook into the page HTML processing pipeline with a Babel-style AST
 * visitor. Pass an `enforce` phase to change how this visitor will
 * influence other visitors. Visitors of the same phase are never
 * influenced by each other.
 */
export const traverseHtml = ((arg, arg2) => {
  let enforce: EnforcementPhase | undefined
  if (!arg || typeof arg == 'string') {
    enforce = arg
    arg = arg2!
  }
  const traverseFn = findHtmlProcessor<TraverseVisitor>(
    enforce,
    p => kVisitorsArray in p
  )
  if (traverseFn) {
    const visitors = traverseFn[kVisitorsArray]
    if (Array.isArray(arg)) {
      arg.forEach(visitor => visitors.push(visitor))
    } else {
      visitors.push(arg)
    }
  } else {
    processHtml(enforce, {
      name: 'traverseHtml',
      process: bindVisitors(arg),
    })
  }
}) as TraverseHtmlHook
