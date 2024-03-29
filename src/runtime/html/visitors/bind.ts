import { MagicString } from '@utils/magic-string'
import { onChange } from '../onChange'
import { parseHtml } from '../parser'
import { HtmlTagPath } from '../path'
import { kVisitorsArray } from '../symbols'
import {
  HtmlDocument,
  HtmlTag,
  HtmlTextLike,
  HtmlVisitor,
  HtmlVisitorState,
} from '../types'

export type TraverseVisitor<
  State extends HtmlVisitor.BaseState = HtmlVisitorState
> = ([State] extends [Any]
  ? (html: string, state?: HtmlDocument<State>['state']) => Promise<string>
  : [State, object] extends [object, State]
  ? (html: string, state?: HtmlDocument<State>['state']) => Promise<string>
  : (html: string, state: HtmlDocument<State>['state']) => Promise<string>) & {
  [kVisitorsArray]: HtmlVisitor[]
}

export function bindVisitors<
  State extends HtmlVisitor.BaseState = HtmlVisitorState
>(arg: HtmlVisitor<State> | HtmlVisitor<State>[]) {
  const visitors = Array.isArray(arg) ? arg : [arg]

  type DocumentState = HtmlDocument<State>['state']

  async function traverse(html: string, state: DocumentState) {
    // Ensure an <html> tag exists.
    html = injectHtmlTag(html)

    const editor = new MagicString(html)
    const document: HtmlDocument<State> = { editor, state }

    for (const tag of parseHtml(html)) {
      if (tag.type == 'Comment') {
        continue
      }
      const observer = createObserver(tag, editor)
      const observedTag = onChange(tag, observer)
      const path = new HtmlTagPath(document, observedTag)
      await path.traverse(visitors)
    }

    return editor.toString()
  }

  Object.defineProperty(traverse, kVisitorsArray, {
    value: visitors,
  })

  /**
   * This `extends` type checks for the following:
   *   - where State is any or never (the only types that extend `Any`)
   *   - where State is {} or object (the only types that extend `object` and vice versa)
   * In those cases, the `state` argument is optional.
   */
  return traverse as TraverseVisitor<State>
}

// Used for `any` type detection.
declare class Any {
  private _: any
}

function injectHtmlTag(html: string) {
  return /<html( |>)/i.test(html)
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
  (keyPath: string[], value: any, oldValue: any) => {
    if (typeof value !== 'string') {
      throw Error(`Property mutation must be string-based`)
    }
    const lastKey = keyPath.pop() as string
    // A text node or attribute node can have its value edited.
    if (lastKey === 'value') {
      const node = resolveKeyPath<HtmlTextLike>(tag, keyPath)
      // Undo the change, so visitors in the same pass never affect each other.
      node[lastKey] = oldValue
      editor.overwrite(
        node.start + (node.type == 'Text' ? 0 : node.type == 'Comment' ? 4 : 1),
        node.end - (node.type == 'Text' ? 0 : node.type == 'Comment' ? 3 : 1),
        value
      )
    }
    // A tag node can have its name edited.
    else if (lastKey === 'name' || lastKey === 'rawName') {
      const node = resolveKeyPath<HtmlTag>(tag, keyPath)
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
      throw Error(`Unsupported property mutation: ${keyPath.join('.')}`)
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
