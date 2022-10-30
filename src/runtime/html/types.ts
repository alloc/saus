import { MagicString } from '@utils/magic-string'
import { Remap } from '@utils/types'
import type { HtmlTagPath } from './path'
import type { HtmlProcessorState } from './process'
import type { kTagPath } from './symbols'

type Promisable<T> = T | PromiseLike<T>

type HtmlTagState<State extends HtmlVisitor.BaseState = any> = {
  /** The tag whose URL attribute is being resolved */
  tag: HtmlTagPath<State>
  /** The URL attribute being resolved */
  attr: string
}

export namespace HtmlResolver {
  export type BaseState = Partial<HtmlVisitorState & HtmlTagState>
}

export type HtmlResolverState<State extends HtmlResolver.BaseState = {}> =
  Remap<State & HtmlVisitorState & HtmlTagState<State>>

export type HtmlResolver<State extends HtmlVisitor.BaseState = {}> = (
  id: string,
  importer: string,
  state: HtmlResolverState<State>
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
  [kTagPath]?: HtmlTagPath<any>
}

export type { HtmlTagPath }

export type HtmlTagVisitor<
  State extends HtmlVisitor.BaseState = HtmlVisitorState
> =
  | HtmlVisitFn<State>
  | {
      open?: HtmlVisitFn<State>
      close?: HtmlVisitFn<State>
    }

export type HtmlVisitor<
  State extends HtmlVisitor.BaseState = HtmlVisitorState
> = {
  [tag: string]: HtmlTagVisitor<State>
} & {
  open?: HtmlVisitFn<State>
  close?: HtmlVisitFn<State>
  /**
   * This visitor will always be called, because `traverseHtml` injects
   * an `<html>` tag if none exists.
   */
  html?: HtmlTagVisitor<State>
}

export type HtmlVisitFn<
  State extends HtmlVisitor.BaseState = HtmlVisitorState
> = (path: HtmlTagPath<State>, state: State) => void | Promise<void>

export namespace HtmlVisitor {
  export type BaseState = Partial<HtmlVisitorState>
}

/**
 * Page-specific state shared between visitors.
 */
export type HtmlVisitorState = HtmlProcessorState

export type HtmlDocument<
  State extends HtmlVisitor.BaseState = HtmlVisitorState
> = {
  editor: MagicString
  state: Remap<State & HtmlVisitorState>
}
