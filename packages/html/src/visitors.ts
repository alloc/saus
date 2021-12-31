import { parse, SyntaxKind } from 'html5parser'
import MagicString from 'magic-string'
import onChange from 'on-change'
import { HtmlTagPath } from './path'
import { kRemovedNode, kVisitorsArray } from './symbols'
import {
  HtmlAttributeValue,
  HtmlDocument,
  HtmlNode,
  HtmlTag,
  HtmlText,
  HtmlVisitor,
  HtmlVisitorState,
} from './types'

export type TraverseVisitor = ReturnType<typeof bindVisitors> & {
  [kVisitorsArray]: HtmlVisitor[]
}

export function bindVisitors(arg: HtmlVisitor | HtmlVisitor[]) {
  const visitors = Array.isArray(arg) ? arg : [arg]

  async function traverse(html: string, state: HtmlVisitorState) {
    // Ensure an <html> tag exists.
    html = injectHtmlTag(html)

    const editor = new MagicString(html)
    const document: HtmlDocument = { editor, state }

    for (const tag of parse(html, { setAttributeMap: true })) {
      if (!isTag(tag)) {
        continue
      }
      const observer = createObserver(tag, editor)
      const observedTag = onChange(tag, observer, {
        ignoreSymbols: true,
      })
      const path = new HtmlTagPath(document, observedTag)
      await path.traverse(visitors)
    }

    return editor.toString()
  }

  Object.defineProperty(traverse, kVisitorsArray, {
    value: visitors,
  })

  return traverse
}

function injectHtmlTag(html: string) {
  return /<html /i.test(html)
    ? html
    : html.replace(/^(<!doctype html>)?/i, doctype => `${doctype}\n<html>`) +
        `\n</html>`
}

/**
 * Create a function used with `on-change` to detect when
 * an AST node is mutated directly.
 */
const createObserver =
  (tag: HtmlTag, editor: MagicString) =>
  (path: string, value: any, oldValue: any) => {
    if (typeof value !== 'string') {
      throw Error(`Property mutation must be string-based`)
    }
    const keys = path.split('.')
    const lastKey = keys.pop() as string
    // A text node or attribute node can have its value edited.
    if (lastKey === 'value') {
      const node = resolveKeyPath<HtmlText | HtmlAttributeValue>(tag, keys)
      // Undo the change, so visitors in the same pass never affect each other.
      node[lastKey] = oldValue
      editor.overwrite(node.start, node.end, value)
    }
    // A tag node can have its name edited.
    else if (lastKey === 'name' || lastKey === 'rawName') {
      const node = resolveKeyPath<HtmlTag>(tag, keys)
      // Undo the change, so visitors in the same pass never affect each other.
      node[lastKey] = oldValue

      if (lastKey === 'name') {
        value = value.toLowerCase()
      }

      const { open, close } = node
      editor.overwrite(open.start + 1, open.start + oldValue.length + 1, value)
      if (close) {
        editor.overwrite(close.start + 2, close.end - 1, value)
      }
    } else {
      throw Error(`Unsupported property mutation: ${path}`)
    }
  }

function resolveKeyPath<T = any>(value: any, keys: string[], index = 0): T {
  if (keys.length) {
    value = value[keys[index++]]
    if (index < keys.length) {
      return resolveKeyPath(value, keys, index)
    }
  }
  return value as T
}

export function mergeVisitors(
  arg: HtmlVisitor | HtmlVisitor[],
  state: HtmlVisitorState
) {
  const visitors = Array.isArray(arg) ? arg : [arg]
  const skippedVisitorsByPath = new Map<HtmlTagPath, Set<HtmlVisitor>>()
  const skippedPathsByVisitor = new Map<HtmlVisitor, HtmlTagPath>()

  /** The visitor targeted by `path.skip` calls. */
  let currentVisitor: HtmlVisitor | null = null
  /** Visitors with an `open` listener. */
  let openVisitors: HtmlVisitor[]
  /** Visitors with tag-specific listeners. */
  let tagVisitors: HtmlVisitor[]
  /** Visitors with a `close` listener. */
  let closeVisitors: HtmlVisitor[]

  const visit = async (
    path: HtmlTagPath,
    visitor: HtmlVisitor,
    handler: (
      path: HtmlTagPath,
      state: HtmlVisitorState
    ) => void | Promise<void>
  ) => {
    currentVisitor = visitor
    await handler(path, state)
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
    async open(path: HtmlTagPath) {
      for (const visitor of openVisitors) {
        await visit(path, visitor, visitor.open!)
        if (path[kRemovedNode]) {
          return true
        }
      }
      for (const visitor of tagVisitors) {
        const handler = visitor[path.node.name]
        const openHandler =
          handler && (typeof handler == 'function' ? handler : handler.open)

        if (openHandler) {
          await visit(path, visitor, openHandler)
          if (path[kRemovedNode]) {
            return true
          }
        }
      }
      // Avoid traversing descendants if no visitors are eligible.
      return !openVisitors.length && !tagVisitors.length
    },
    async close(path: HtmlTagPath) {
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
          await visit(path, visitor, closeHandler)
          if (path[kRemovedNode]) {
            return
          }
        }
      }
      for (const visitor of closeVisitors) {
        await visit(path, visitor, visitor.close!)
        if (path[kRemovedNode]) {
          return
        }
      }
    },
    skip(path: HtmlTagPath) {
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

const keywords = ['open', 'close', 'html']

const kTagVisitor = Symbol.for('html.TagVisitor')

function isTagVisitor(visitor: HtmlVisitor & { [kTagVisitor]?: boolean }) {
  return (visitor[kTagVisitor] ??= Object.keys(visitor).some(
    key => !keywords.includes(key)
  ))
}

export function isTag(node: HtmlNode): node is HtmlTag {
  return node.type == SyntaxKind.Tag
}

function isDescendant(
  childPath: HtmlTagPath | undefined,
  parentPath: HtmlTagPath
) {
  while (childPath) {
    if (childPath == parentPath) {
      return true
    }
    childPath = childPath.parentPath
  }
  return false
}
