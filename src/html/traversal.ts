import { htmlEscape } from 'escape-goat'
import { parse, SyntaxKind } from 'html5parser'
import MagicString from 'magic-string'
import onChange from 'on-change'
import { noop } from '../utils/noop'
import { $ } from './selector'
import {
  HtmlAttributeValue,
  HtmlNode,
  HtmlSelector,
  HtmlTag,
  HtmlText,
  HtmlVisitor,
  HtmlVisitorState,
} from './types'

export const kTagPath = Symbol.for('html.TagPath')

/** Indicates a removed or replaced node */
const kRemovedNode = Symbol.for('html.RemovedNode')

function resolveKeyPath<T = any>(value: any, keys: string[], index = 0): T {
  if (keys.length) {
    value = value[keys[index++]]
    if (index < keys.length) {
      return resolveKeyPath(value, keys, index)
    }
  }
  return value as T
}

type HtmlTraversalContext = {
  editor: MagicString
  state: HtmlVisitorState
}

export async function traverse(
  html: string,
  state: HtmlVisitorState,
  visitors: HtmlVisitor | HtmlVisitor[]
) {
  const editor = new MagicString(html)
  const context: HtmlTraversalContext = { editor, state }

  for (const tag of parse(html, { setAttributeMap: true })) {
    if (!isTag(tag)) {
      continue
    }

    const observer = (path: string, value: any, oldValue: any) => {
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
        editor.overwrite(
          open.start + 1,
          open.start + oldValue.length + 1,
          value
        )
        if (close) {
          editor.overwrite(close.start + 2, close.end - 1, value)
        }
      } else {
        throw Error(`Unsupported property mutation: ${path}`)
      }
    }

    const path = new HtmlTagPath(
      context,
      onChange(tag, observer, {
        ignoreSymbols: true,
      })
    )

    await path.traverse(visitors)
  }

  return editor.toString()
}

const unaryTags = new Set(['link', 'meta', 'base'])

type InsertionMethod =
  | 'prependLeft'
  | 'prependRight'
  | 'appendLeft'
  | 'appendRight'

function getTagPath(node: HtmlTag, parentPath: HtmlTagPath) {
  return (node[kTagPath] ||= new HtmlTagPath(
    parentPath.context,
    node,
    parentPath
  ))
}

export class HtmlTagPath {
  constructor(
    readonly context: HtmlTraversalContext,
    readonly node: HtmlTag,
    readonly parentPath?: HtmlTagPath
  ) {
    this.parentNode = parentPath?.node
    this.editor = context.editor
    this.skip = noop
  }
  readonly parentNode?: HtmlTag
  protected editor: MagicString
  protected [kRemovedNode]?: boolean
  /**
   * Equals false if a child was added to a self-closing tag.
   */
  protected selfClosing = this.node.close == null

  get tagName() {
    return this.node.name
  }
  set tagName(name: string) {
    this.node.rawName = name
  }

  get attributes(): Record<string, true | string | undefined> {
    return new Proxy(this.node.attributeMap, {
      get(target, key: string) {
        const attribute = target[key]
        if (attribute) {
          if (attribute.value) {
            return attribute.value.value
          }
          return true
        }
      },
      set: (target, key: string, value) => {
        this.setAttribute(key, value)
        return true
      },
    }) as any
  }

  get innerHTML() {
    return this.node.close
      ? this.editor.original.slice(this.node.open.end, this.node.close.start)
      : ''
  }
  set innerHTML(html: string) {
    if (this.node.body) {
      for (const childNode of this.node.body) {
        if (isTag(childNode)) {
          const childPath = getTagPath(childNode, this)
          childPath[kRemovedNode] = true
        }
      }
    }
    if (this.node.close) {
      this.editor.overwrite(this.node.open.end, this.node.close.start, html)
    } else {
      if (this.selfClosing) {
        this.addClosingTag()
      }
      this.editor.appendLeft(this.node.open.end, html)
    }
  }

  /**
   * Skip traversal of descendants for this element-visitor pair.
   *
   * Note: The `close` handler will still be invoked for this element.
   */
  skip: () => void

  traverse(visitors: HtmlVisitor | HtmlVisitor[]) {
    const mergedVisitor = mergeVisitors(visitors, this.context.state)
    const traversePath = async (path: HtmlTagPath) => {
      path.skip = () => mergedVisitor.skip(path)

      const shouldSkip = await mergedVisitor.open(path)
      if (!shouldSkip && path.node.body)
        for (const childProxy of path.node.body) {
          if (isTag(childProxy)) {
            const childNode = onChange.target(childProxy)
            const childPath = getTagPath(childNode, path)
            if (!childPath[kRemovedNode]) {
              await traversePath(childPath)
            }
          }
        }

      path.skip = noop

      // Skip "close" handlers if node was removed.
      if (!path[kRemovedNode]) {
        await mergedVisitor.close(path)
      }
    }

    return traversePath(this)
  }

  remove() {
    this[kRemovedNode] = true
    this.editor.remove(this.node.start, this.node.end)
  }

  replace(html: string) {
    this[kRemovedNode] = true
    this.editor.overwrite(this.node.start, this.node.end, html)
  }

  protected addClosingTag() {
    if (unaryTags.has(this.node.name)) {
      throw Error(`"${this.node.name}" tags cannot have children`)
    }
    const start = this.node.open.end
    this.editor.overwrite(start - 2, start, '>')
    this.editor.appendRight(start, `</${this.node.name}>`)
    this.selfClosing = false
  }

  protected addChild(index: number, html: string, method: InsertionMethod) {
    let start: number
    if (this.node.body) {
      index = Math.min(Math.max(index, 0), this.node.body.length)
      start = index == 0 ? this.node.open.end : this.node.body[index - 1].end
    } else {
      start = this.node.open.end
      if (this.selfClosing) {
        this.addClosingTag()
      }
    }
    this.editor[method](start, html)
  }

  /**
   * Insert content before the child node at the given index.
   *
   * The index is clamped, so negative indices are equivalent to zero.
   */
  insertChild(index: number, html: string) {
    this.addChild(index, html, 'appendLeft')
  }

  /**
   * Content added with a `prependChild` call always comes before content
   * added with an `insertChild` call.
   */
  prependChild(html: string) {
    this.addChild(0, html, 'prependLeft')
  }

  /**
   * Convenience method for `insertChild(Infinity, html)`
   */
  appendChild(html: string) {
    this.addChild(Infinity, html, 'appendLeft')
  }

  setAttribute(name: string, value: string | boolean) {
    if (value === false) {
      return this.removeAttribute(name)
    }

    value = name + (typeof value == 'string' ? `="${htmlEscape(value)}"` : '')

    let start: number
    let end: number

    const attribute = this.node.attributeMap[name]
    if (attribute) {
      start = attribute.start
      end = attribute.end
    } else {
      start = end = this.node.open.end - (this.node.body ? 1 : 2)
      if (this.selfClosing) {
        value += ' '
      }
    }

    if (this.editor.original[start - 1] !== ' ') {
      value = ' ' + value
    }

    if (start == end) {
      this.editor.appendRight(start, value)
    } else {
      this.editor.overwrite(start, end, value)
    }
  }

  removeAttribute(name: string) {
    const attribute = this.node.attributeMap[name]
    if (attribute) {
      let { start, end } = attribute
      if (this.editor.original[start - 1] === ' ') {
        start -= 1
      }
      this.editor.remove(start, end)
    }
  }

  /**
   * This always returns the **original** HTML (before changes made by visitors).
   */
  toString() {
    return this.editor.original.slice(this.node.start, this.node.end)
  }
}

function mergeVisitors(
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
        if (handler) {
          await visit(path, visitor, handler)
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
      for (const visitor of closeVisitors) {
        await visit(path, visitor, visitor.close!)
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

const selectorRE = /[., >#*]/

const kTagVisitor = Symbol.for('html.TagVisitor')

function isTagVisitor(visitor: HtmlVisitor & { [kTagVisitor]?: boolean }) {
  let result = visitor[kTagVisitor]
  if (result == null) {
    // Parse selector keys at the same time.
    const selectors: HtmlSelector[] = []
    for (const key in visitor) {
      if (key !== 'open' && key !== 'close') {
        result = true
        if (selectorRE.test(key)) {
          selectors.push($(key, visitor[key]))
        }
      }
    }
    if (selectors.length) {
      const onOpen = visitor.open
      visitor.open = async (path, state) => {
        for (const selector of selectors) {
          await selector.open(path, state)
        }
        if (onOpen) {
          await onOpen(path, state)
        }
      }
    }
    visitor[kTagVisitor] = result
  }
  return result
}

function isTag(node: HtmlNode): node is HtmlTag {
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
