import { limitTime } from '@utils/limitTime'
import { HtmlTagPath } from '../path'
import { HtmlProcessorState } from '../process'
import { kRemovedNode } from '../symbols'
import { HtmlVisitor, HtmlVisitorState } from '../types'

const rootOnlyTags = ['head', 'body']
const headOnlyTags = ['base', 'link', 'meta', 'style', 'title']
const isHeadOnlyTag = (tagName: string) => headOnlyTags.includes(tagName)

export function mergeVisitors<
  State extends HtmlVisitor.BaseState = HtmlVisitorState
>(
  arg: HtmlVisitor<State> | HtmlVisitor<State>[],
  state?: State & HtmlVisitorState
) {
  const visitors = Array.isArray(arg) ? arg : [arg]

  type Visitor = HtmlVisitor<State>
  type TagPath = HtmlTagPath<State>

  // Use a smaller timeout than configured to ensure ours triggers first.
  const timeout = (state?.config.htmlTimeout ?? 10) - 0.1

  /** The visitor targeted by `path.skip` calls. */
  let currentVisitor: Visitor | null = null

  const visit = async (
    path: TagPath,
    visitor: Visitor,
    handler: (path: TagPath, state: State) => void | Promise<void>,
    name: string
  ) => {
    currentVisitor = visitor
    await limitTime(
      handler(path, state!),
      timeout,
      `HTML visitor "${name}" took too long`
    )
    currentVisitor = null
  }

  const skippedVisitorsByPath = new Map<TagPath, Set<Visitor>>()
  const skippedPathsByVisitor = new Map<Visitor, TagPath>()

  const skip = (path: TagPath, visitor: Visitor) => {
    const prevSkippedPath = skippedPathsByVisitor.get(visitor)
    if (prevSkippedPath) {
      if (isDescendant(path, prevSkippedPath)) {
        return // This path or an ancestor is already skipped.
      }
      const skippedVisitors = skippedVisitorsByPath.get(prevSkippedPath)!
      skippedVisitors.delete(visitor)
      if (!skippedVisitors.size) {
        skippedVisitorsByPath.delete(path)
      }
    }

    const skippedVisitors = skippedVisitorsByPath.get(path) || new Set()
    skippedVisitorsByPath.set(path, skippedVisitors)
    skippedVisitors.add(visitor)

    skippedPathsByVisitor.set(visitor, path)
    if (!prevSkippedPath) {
      resetVisitors()
    }
  }

  let tagVisitors: HtmlTagVisitor<State>[] = visitors.filter(isTagVisitor)
  let openVisitors: Visitor[] = visitors.filter(v => v.open)
  let closeVisitors: Visitor[] = visitors.filter(v => v.close)
  let activeVisitorCount: number

  const countActiveVisitors = () =>
    (activeVisitorCount =
      tagVisitors.length + openVisitors.length + closeVisitors.length)

  const resetVisitors = () => {
    const eligibleVisitors = visitors.filter(v => !skippedPathsByVisitor.has(v))
    tagVisitors = eligibleVisitors.filter(isTagVisitor)
    openVisitors = eligibleVisitors.filter(v => v.open)
    closeVisitors = eligibleVisitors.filter(v => v.close)
    countActiveVisitors()
  }

  const open = async (path: TagPath, tagVisitors: Visitor[]) => {
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
  }

  const close = async (path: TagPath, tagVisitors: Visitor[]) => {
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
  }

  type TagWalker = {
    open(
      path: TagPath,
      descend: (path: TagPath) => Promise<void>
    ): Promise<void>
    close(path: TagPath): Promise<void>
  }

  type UniqueTagWalker = TagWalker & {
    visitors: Visitor[]
  }

  // The active walker, which decides how the tree is walked.
  let walker: TagWalker

  const uniqueWalkers: Record<string, UniqueTagWalker> = {
    html: {
      visitors: visitors.filter(v => v.html),
      async open(path, descend) {
        await open(path, this.visitors)
        tagVisitors = visitors.filter(visitor => {
          if (!isTagVisitor(visitor)) return false
          if (rootOnlyTags.some(tag => visitor[tag])) return true
          skip(path, visitor)
        })
        walker = rootWalker
        return descend(path)
      },
      close(path: TagPath) {
        return close(path, this.visitors)
      },
    },
    head: {
      visitors: visitors.filter(v => v.head),
      async open(path, descend) {
        await open(path, this.visitors)
        tagVisitors = visitors.filter(visitor => {
          if (!isTagVisitor(visitor)) return false
          if (visitor.script) return true
          if (headOnlyTags.some(tag => visitor[tag])) return true
          skip(path, visitor)
        })
        if (path.node.body && countActiveVisitors()) {
          walker = defaultWalker
          return descend(path)
        }
      },
      close(path: TagPath) {
        return close(path, this.visitors)
      },
    },
    body: {
      visitors: visitors.filter(v => v.body),
      async open(path, descend) {
        await open(path, this.visitors)
        tagVisitors = visitors.filter(visitor => {
          if (!isTagVisitor(visitor)) return false
          const visitedTags = (visitor as HtmlTagVisitor)[kVisitedTags]!
          if (!visitedTags.every(isHeadOnlyTag)) return true
          skip(path, visitor)
        })
        if (path.node.body && countActiveVisitors()) {
          walker = defaultWalker
          return descend(path)
        }
      },
      close(path: TagPath) {
        return close(path, this.visitors)
      },
    },
  }

  const rootWalker: TagWalker = {
    open(path, descend) {
      return (uniqueWalkers[path.tagName] || defaultWalker).open(path, descend)
    },
    close(path) {
      return (uniqueWalkers[path.tagName] || defaultWalker).close(path)
    },
  }

  const defaultWalker: TagWalker = {
    async open(path, descend) {
      await open(path, tagVisitors)
      if (path.node.body && activeVisitorCount) {
        return descend(path)
      }
    },
    close(path) {
      return close(path, tagVisitors)
    },
  }

  type MergedVisitor = TagWalker & {
    visitors: Visitor[]
    skip(path: TagPath): void
  }

  const noop: () => any = () => {}
  const mergedVisitor: MergedVisitor = {
    visitors,
    async open(path, descend) {
      const cachedWalker = walker
      await cachedWalker.open(path, descend)
      this.close = cachedWalker.close.bind(cachedWalker)
    },
    close: noop,
    skip(path) {
      currentVisitor && skip(path, currentVisitor)
    },
  }

  walker = rootWalker
  return mergedVisitor
}

const keywords = ['open', 'close', 'html', 'head', 'body']

const kVisitedTags = Symbol.for('html.visitedTags')

type HtmlTagVisitor<T extends Partial<HtmlProcessorState> = any> =
  HtmlVisitor<T> & { [kVisitedTags]?: string[] }

function isTagVisitor(visitor: HtmlTagVisitor) {
  let visitedTags = visitor[kVisitedTags]
  if (!visitedTags)
    Object.defineProperty(visitor, kVisitedTags, {
      value: (visitedTags = Object.keys(visitor).filter(
        key => !keywords.includes(key)
      )),
    })

  return visitedTags.length > 0
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
