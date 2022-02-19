import { limitTime } from 'saus/core'
import { HtmlTagPath } from '../path'
import { kRemovedNode } from '../symbols'
import { HtmlVisitor, HtmlVisitorState } from '../types'

export function mergeVisitors<
  State extends HtmlVisitor.BaseState = HtmlVisitorState
>(
  arg: HtmlVisitor<State> | HtmlVisitor<State>[],
  state: State & HtmlVisitorState
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
  const timeout = (state.config.htmlTimeout ?? 10) - 0.1

  const visit = async (
    path: TagPath,
    visitor: Visitor,
    handler: (path: TagPath, state: State) => void | Promise<void>,
    name: string
  ) => {
    currentVisitor = visitor
    await limitTime(
      handler(path, state),
      timeout,
      `HTML visitor "${name}" took too long`
    )
    currentVisitor = null
  }

  const resetVisitors = () => {
    const eligibleVisitors = visitors.filter(v => !skippedPathsByVisitor.has(v))
    tagVisitors = eligibleVisitors.filter(isTagVisitor)
    openVisitors = eligibleVisitors.filter(v => v.open)
    closeVisitors = eligibleVisitors.filter(v => v.close)
  }

  resetVisitors()
  return {
    async open(path: TagPath) {
      for (const visitor of openVisitors) {
        await visit(path, visitor, visitor.open!, 'open')
        if (path[kRemovedNode]) {
          return true
        }
      }
      for (const visitor of tagVisitors) {
        const handler = visitor[path.node.name]
        const openHandler =
          handler && (typeof handler == 'function' ? handler : handler.open)

        if (openHandler) {
          const name = path.node.name + (handler == openHandler ? '' : '.open')
          await visit(path, visitor, openHandler, name)
          if (path[kRemovedNode]) {
            return true
          }
        }
      }
      // Avoid traversing descendants if no visitors are eligible.
      return 1 > openVisitors.length + tagVisitors.length + closeVisitors.length
    },
    async close(path: TagPath) {
      const skippedVisitors = skippedVisitorsByPath.get(path)
      if (skippedVisitors) {
        skippedVisitors.forEach(visitor => {
          skippedPathsByVisitor.delete(visitor)
        })
        skippedVisitorsByPath.delete(path)
        resetVisitors()
      }
      for (const visitor of tagVisitors) {
        const handler = visitor[path.node.name]
        const closeHandler =
          handler && typeof handler !== 'function' && handler.close

        if (closeHandler) {
          await visit(path, visitor, closeHandler, path.node.name + '.close')
          if (path[kRemovedNode]) {
            return
          }
        }
      }
      for (const visitor of closeVisitors) {
        await visit(path, visitor, visitor.close!, 'close')
        if (path[kRemovedNode]) {
          return
        }
      }
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
