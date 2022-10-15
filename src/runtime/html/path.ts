import { MagicString } from '@utils/babel'
import { escape } from '@utils/escape'
import { HtmlProcessorState } from './process'
import { kRemovedNode, kTagPath } from './symbols'
import { HtmlDocument, HtmlTag, HtmlVisitor, HtmlVisitorState } from './types'
import { mergeVisitors } from './visitors/merge'

const noop = () => {}

function getTagPath<State extends Partial<HtmlProcessorState>>(
  node: HtmlTag,
  parentPath: HtmlTagPath<State>
): HtmlTagPath<State> {
  return (node[kTagPath] ||= new HtmlTagPath(
    parentPath.document,
    node,
    parentPath
  ))
}

const unaryTags = new Set(['link', 'meta', 'base'])

type InsertionMethod =
  | 'prependLeft'
  | 'prependRight'
  | 'appendLeft'
  | 'appendRight'

export class HtmlTagPath<
  State extends HtmlVisitor.BaseState = HtmlVisitorState
> {
  constructor(
    readonly document: HtmlDocument<State>,
    readonly node: HtmlTag,
    readonly parentPath?: HtmlTagPath<State>
  ) {
    this.parentNode = parentPath?.node
    this.editor = document.editor
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

  get debugName() {
    const { class: className, id } = this.attributes
    return (
      this.tagName +
      (id ? '#' + id : '') +
      (className ? '.' + (className as string).split(' ').join('.') : '')
    )
  }

  get debugPath() {
    let debugPath = this.debugName
    let { parentPath } = this
    while (parentPath) {
      debugPath = parentPath.debugName + ' > ' + debugPath
      parentPath = parentPath.parentPath
    }
    Object.defineProperty(this, 'debugPath', { value: debugPath })
    return debugPath
  }

  get attributes(): Record<string, true | string | undefined> {
    const attributes = new Proxy(this.node.attributeMap, {
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
    })

    Object.defineProperty(this, 'attributes', { value: attributes })
    return attributes as any
  }

  get innerHTML() {
    return this.node.close
      ? this.editor.original.slice(this.node.open.end, this.node.close.start)
      : ''
  }
  set innerHTML(html: string) {
    if (this.node.body) {
      for (const childNode of this.node.body) {
        if (childNode.type == 'Tag') {
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

  traverse(visitors: HtmlVisitor<State> | HtmlVisitor<State>[]) {
    const mergedVisitor = mergeVisitors(visitors, this.document.state)

    const traversePath = async (path: HtmlTagPath<State>) => {
      path.skip = () => mergedVisitor.skip(path)
      await mergedVisitor.open(path, traverseBody)
      path.skip = noop
      if (!path[kRemovedNode]) {
        await mergedVisitor.close(path)
      }
    }
    const traverseBody = async (path: HtmlTagPath<State>) => {
      for (const childNode of path.node.body!) {
        if (childNode.type == 'Tag') {
          const childPath = getTagPath(childNode, path)
          if (!childPath[kRemovedNode]) {
            await traversePath(childPath)
          }
        }
      }
    }

    return traversePath(this)
  }

  children() {
    const children: HtmlTagPath<State>[] = []
    this.node.body?.forEach(childNode => {
      if (childNode.type == 'Tag') {
        children.push(getTagPath(childNode, this))
      }
    })
    return children
  }

  async findChild<T>(
    iterator: (
      child: HtmlTagPath<State>,
      index: number,
      siblings: HtmlTagPath<State>[]
    ) => Promise<T | null | void> | T | null | void
  ) {
    const children = this.children()
    for (let i = 0; i < children.length; i++) {
      const childPath = children[i]
      if (!childPath[kRemovedNode]) {
        const result = await iterator(children[i], i, children)
        if (result != null) {
          return result
        }
      }
    }
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

    value = name + (typeof value == 'string' ? `="${escape(value)}"` : '')

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
