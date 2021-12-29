import { addHtmlVisitor } from '../core/html'
import { EnforcementPhase, HtmlVisitor } from './types'

export * from './types'
export * from './resolver'
export * from './selector'

export function transformHtml(visitor: HtmlVisitor): void

export function transformHtml(visitors: HtmlVisitor[]): void

export function transformHtml(
  enforce: EnforcementPhase,
  visitor: HtmlVisitor
): void

export function transformHtml(
  enforce: EnforcementPhase,
  visitors: HtmlVisitor[]
): void

export function transformHtml(
  arg: EnforcementPhase | HtmlVisitor | HtmlVisitor[],
  arg2?: HtmlVisitor | HtmlVisitor[]
) {
  let enforce: EnforcementPhase | undefined
  if (typeof arg == 'string') {
    enforce = arg
    arg = arg2!
  }
  if (Array.isArray(arg)) {
    arg.forEach(visitor => addHtmlVisitor(visitor, enforce))
  } else {
    addHtmlVisitor(arg, enforce)
  }
}
