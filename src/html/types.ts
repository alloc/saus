import type { IAttribute, ITag } from 'html5parser'
import type { RenderedPage } from '../pages'
import type { HtmlTagPath, kTagPath } from './traversal'

type Promisable<T> = T | PromiseLike<T>

export type EnforcementPhase = 'pre' | 'post'

export type HtmlResolver = (
  id: string,
  importer: string,
  state: HtmlVisitorState
) => Promisable<string | null | void>

export type {
  INode as HtmlNode,
  IText as HtmlText,
  IAttribute as HtmlAttribute,
  IAttributeValue as HtmlAttributeValue,
} from 'html5parser'

export type HtmlTag = ITag & {
  attributeMap: Record<string, IAttribute>
  [kTagPath]?: HtmlTagPath
}

export type { HtmlTagPath }

export type HtmlVisitor = {
  [tag: string]: HtmlVisitFn
} & {
  open?: HtmlVisitFn
  close?: HtmlVisitFn
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
}

export type HtmlSelector = Required<Pick<HtmlVisitor, 'open'>>
