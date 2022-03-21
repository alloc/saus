import { limitTime } from 'saus/core'
import { HtmlTagPath } from '../path'
import { kRemovedNode } from '../symbols'
import {
  HtmlTagVisitor,
  HtmlVisitFn,
  HtmlVisitor,
  HtmlVisitorState,
} from '../types'

export function mergeVisitors<
  State extends HtmlVisitor.BaseState = HtmlVisitorState
>(
  arg: HtmlVisitor<State> | HtmlVisitor<State>[],
  state?: State & HtmlVisitorState
) {
  const visitors = Array.isArray(arg) ? arg : [arg]

  type Visitor = HtmlVisitor<State>
  type TagPath = HtmlTagPath<State>

  const skippedVisitorsByPath = new Map<TagPath, Set<Visitor>>()
  const skippedPathsByVisitor = new Map<Visitor, TagPath>()

  /** The visitor targeted by `path.skip` calls. */
  let currentVisitor: Visitor | null = null
  /** Visitors with an `open` listener. */
  let openVisitors: Visitor[]
  /** Visitors with tag-specific listeners. */
  let tagVisitors: Visitor[]
  /** Visitors with a `close` listener. */
  let closeVisitors: Visitor[]

  // Use a smaller timeout than configured to ensure ours triggers first.
  const timeout = (state?.config.htmlTimeout ?? 10) - 0.1

  const visit = (
    path: TagPath,
    phase: 'open' | 'close',
    tagName: string | null,
    visitors: HtmlVisitor<State>[],
    done: (removed: boolean) => Promise<void> | void
  ): Promise<void> | void => {
    let visitorIndex = -1
    const isOpen = phase == 'open'
    return (function nextVisitor(): Promise<void> | void {
      if (path[kRemovedNode]) {
        return done(true)
      }
      while (++visitorIndex < visitors.length) {
        const visitor = visitors[visitorIndex]

        const tagVisitor = visitor[tagName || phase]
        if (!tagVisitor) {
          continue
        }

        const handler =
          typeof tagVisitor == 'function'
            ? isOpen || !tagName
              ? tagVisitor
              : undefined
            : tagName
            ? tagVisitor[phase]
            : undefined

        if (handler) {
          currentVisitor = visitor
          const result = handler(path, state!)
          if (result) {
            return result.finally(() => {
              currentVisitor = null
              return process.nextTick(nextVisitor)
            })
          }
          currentVisitor = null
          return process.nextTick(nextVisitor)
        }
      }
      return done(false)
    })()
  }

  const resetVisitors = () => {
    const eligibleVisitors = visitors.filter(v => !skippedPathsByVisitor.has(v))
    tagVisitors = eligibleVisitors.filter(isTagVisitor)
    openVisitors = eligibleVisitors.filter(v => v.open)
    closeVisitors = eligibleVisitors.filter(v => v.close)
  }

  const shouldSkip = () => {
    // Avoid traversing descendants if no visitors are eligible.
    return 1 > openVisitors.length + tagVisitors.length + closeVisitors.length
  }

  resetVisitors()
  return {
    open(path: TagPath, done: (shouldSkip: boolean) => void) {
      return visit(path, 'open', null, openVisitors, removed =>
        removed
          ? done(true)
          : visit(path, 'open', path.node.name, tagVisitors, removed => {
              done(removed || shouldSkip())
            })
      )
    },
    close(path: TagPath, done: () => void) {
      const skippedVisitors = skippedVisitorsByPath.get(path)
      if (skippedVisitors) {
        skippedVisitors.forEach(visitor => {
          skippedPathsByVisitor.delete(visitor)
        })
        skippedVisitorsByPath.delete(path)
        resetVisitors()
      }
      return visit(path, 'close', path.node.name, tagVisitors, removed =>
        removed ? done() : visit(path, 'close', null, closeVisitors, done)
      )
    },
    skip(path: TagPath) {
      if (!currentVisitor) {
        return
      }

      const prevSkippedPath = skippedPathsByVisitor.get(currentVisitor)
      if (prevSkippedPath) {
        if (isDescendant(path, prevSkippedPath)) {
          return // This path or an ancestor is already skipped.
        }
        const skippedVisitors = skippedVisitorsByPath.get(prevSkippedPath)!
        skippedVisitors.delete(currentVisitor)
        if (!skippedVisitors.size) {
          skippedVisitorsByPath.delete(path)
        }
      }

      const skippedVisitors = skippedVisitorsByPath.get(path) || new Set()
      skippedVisitorsByPath.set(path, skippedVisitors)
      skippedVisitors.add(currentVisitor)

      skippedPathsByVisitor.set(currentVisitor, path)
      if (!prevSkippedPath) {
        resetVisitors()
      }
    },
  }
}

const keywords = ['open', 'close']

const kTagVisitor = Symbol.for('html.TagVisitor')

function isTagVisitor(visitor: HtmlVisitor<any> & { [kTagVisitor]?: boolean }) {
  return (visitor[kTagVisitor] ??= Object.keys(visitor).some(
    key => !keywords.includes(key)
  ))
}

function isDescendant(
  childPath: HtmlTagPath<any> | undefined,
  parentPath: HtmlTagPath<any>
) {
  while (childPath) {
    if (childPath == parentPath) {
      return true
    }
    childPath = childPath.parentPath
  }
  return false
}
