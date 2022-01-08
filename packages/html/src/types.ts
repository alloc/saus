import type { default as MagicString } from 'magic-string'
import type { HtmlProcessorState } from 'saus/core'
import type { HtmlTagPath } from './path'
import type { kTagPath } from './symbols'

type Promisable<T> = T | PromiseLike<T>

export type HtmlResolverState = HtmlVisitorState & {
  /** The tag whose URL attribute is being resolved */
  tag: HtmlTagPath
  /** The URL attribute being resolved */
  attr: string
}

export type HtmlResolver = (
  id: string,
  importer: string,
  state: HtmlResolverState
) => Promisable<string | null | void>

export type HtmlNode = {
  type?: 'Text' | 'Tag' | 'Comment'
  start: number
  end: number
}

export type HtmlText = HtmlNode & {
  type: 'Text'
  value: string
}

export type HtmlAttributeValue = HtmlNode & {
  value: string
  quote: '"' | "'"
}

export type HtmlAttribute = HtmlNode & {
  name: HtmlText
  value?: HtmlAttributeValue
}

export type HtmlComment = HtmlNode & {
  type: 'Comment'
  value: string
}

export type HtmlTextLike = HtmlText | HtmlComment | HtmlAttributeValue

export type HtmlTag = HtmlNode & {
  type: 'Tag'
  open: HtmlNode
  name: string
  rawName: string
  close?: HtmlNode
  attributes: HtmlAttribute[]
  attributeMap: Record<string, HtmlAttribute | undefined>
  body?: (HtmlTag | HtmlText | HtmlComment)[]
  [kTagPath]?: HtmlTagPath
}

export type { HtmlTagPath }

export type HtmlTagVisitor =
  | HtmlVisitFn
  | {
      open?: HtmlVisitFn
      close?: HtmlVisitFn
    }

export type HtmlVisitor = {
  [tag: string]: HtmlTagVisitor
} & {
  open?: HtmlVisitFn
  close?: HtmlVisitFn
  /**
   * This visitor will always be called, because `traverseHtml` injects
   * an `<html>` tag if none exists.
   */
  html?: HtmlTagVisitor
}

export type HtmlVisitFn = (
  path: HtmlTagPath,
  state: HtmlVisitorState
) => void | Promise<void>

/**
 * Page-specific state shared between visitors.
 */
export type HtmlVisitorState = HtmlProcessorState

export type HtmlDocument = {
  editor: MagicString
  state: HtmlVisitorState
}
