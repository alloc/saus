import { EnforcementPhase, findHtmlProcessor } from 'saus/core'
import { kVisitorsArray } from './symbols'
import { traverseHtml } from './traversal'
import {
  HtmlResolver,
  HtmlResolverState,
  HtmlTagPath,
  HtmlVisitor,
} from './types'
import { TraverseVisitor } from './visitors'

const kResolverList = Symbol.for('html.ResolverList')

const assetAttrsConfig: Record<string, string[]> = {
  link: ['href'],
  video: ['src', 'poster'],
  source: ['src', 'srcset'],
  img: ['src', 'srcset'],
  image: ['xlink:href', 'href'],
  use: ['xlink:href', 'href'],
}

export function resolveHtmlImports(resolver: HtmlResolver): void

export function resolveHtmlImports(
  enforce: EnforcementPhase,
  resolver: HtmlResolver
): void

export function resolveHtmlImports(
  arg1: HtmlResolver | EnforcementPhase,
  resolver?: HtmlResolver
) {
  let enforce: EnforcementPhase | undefined
  let visitor: HtmlVisitor | undefined

  if (typeof arg1 == 'function') {
    resolver = arg1
  } else {
    enforce = arg1
    assertType<HtmlResolver>(resolver)
  }

  const traverseFn = findHtmlProcessor<TraverseVisitor>(
    enforce,
    p => kVisitorsArray in p
  )

  if (traverseFn) {
    visitor = traverseFn[kVisitorsArray].find(
      visitor => kResolverList in visitor
    )
    if (visitor) {
      const resolvers = Reflect.get(visitor, kResolverList)
      resolvers.push(resolver)
      return
    }
  }

  const resolvers = [resolver]
  const resolve = async (
    path: HtmlTagPath,
    state: Partial<HtmlResolverState>,
    attrs: string[]
  ) => {
    const importer = state.page!.path
    for (const attr of attrs) {
      const id = path.attributes[attr]
      if (typeof id !== 'string') {
        continue
      }
      state.tag = path
      state.attr = attr
      for (const resolveId of resolvers) {
        const resolvedId = await resolveId(
          id,
          importer,
          state as HtmlResolverState
        )
        if (resolvedId != null) {
          path.setAttribute(attr, resolvedId)
          break
        }
      }
      delete state.tag
      delete state.attr
    }
  }

  visitor = {
    // Avoid resolving the URL of a removed node by
    // waiting for the "close" phase.
    close(path, state) {
      const attrs = assetAttrsConfig[path.tagName]
      return attrs && resolve(path, state as any, attrs)
    },
  }

  Object.defineProperty(visitor, kResolverList, {
    value: resolvers,
  })

  traverseHtml(enforce, visitor)
}

function assertType<T>(value: unknown): asserts value is T {}
