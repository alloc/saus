import {
  EnforcedHandler,
  EnforcementPhase,
  findHtmlProcessor,
  processHtml,
} from './process'
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

  const traversePlugin = findTraverseVisitor(enforce)
  if (traversePlugin) {
    const visitors = traversePlugin.process[kVisitorsArray]
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

/**
 * Used by the `traverseHtml` hook to share an AST for traversal among
 * multiple visitors.
 */
export const findTraverseVisitor = (enforce: EnforcementPhase | undefined) =>
  findHtmlProcessor(
    enforce,
    p => typeof p !== 'function' && kVisitorsArray in p.process
  ) as { process: TraverseVisitor } | undefined
