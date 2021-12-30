import type { IAttribute as HtmlAttribute, ITag } from 'html5parser'
import type { RenderedPage, RuntimeConfig } from 'saus/core'
import type { kTagPath } from './symbols'
import type { HtmlTagPath } from './traversal'

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

export type {
  INode as HtmlNode,
  IText as HtmlText,
  IAttribute as HtmlAttribute,
  IAttributeValue as HtmlAttributeValue,
} from 'html5parser'

export type HtmlTag = ITag & {
  attributeMap: Record<string, HtmlAttribute>
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
   * This visitor will be called even if no `<html>` tag exists.
   */
  html?: HtmlTagVisitor
}

export type HtmlVisitorMap = {
  pre: HtmlVisitor[]
  default: HtmlVisitor[]
  post: HtmlVisitor[]
}

export type HtmlVisitFn = (
  path: HtmlTagPath,
  state: HtmlVisitorState
) => void | Promise<void>

/**
 * Page-specific state shared between visitors.
 */
export type HtmlVisitorState = {
  [key: string]: any
} & {
  page: RenderedPage
  config: RuntimeConfig
}

export type HtmlSelector = Required<Pick<HtmlVisitor, 'open'>>
