import { EnforcementPhase, findHtmlProcessor } from 'saus/core'
import { kVisitorsArray } from './symbols'
import { traverseHtml } from './traversal'
import {
  HtmlResolver,
  HtmlResolverState,
  HtmlTagPath,
  HtmlVisitor,
  HtmlVisitorState,
} from './types'
import { TraverseVisitor } from './visitors/bind'

const kResolverList = Symbol.for('html.ResolverList')

const defaultAttrsMap: Record<string, string[]> = {
  a: ['href'],
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

  visitor = createHtmlResolver(resolver)
  traverseHtml(enforce, visitor)
}

function assertType<T>(value: unknown): asserts value is T {}

/**
 * Create a HTML visitor that rewrites URLs.
 *
 * This function is exposed for SSR runtimes, so the visitor
 * **must be manually registered** via the `processHtml` function.
 */
export function createHtmlResolver<State = HtmlVisitorState>(
  resolver: HtmlResolver,
  attrsMap = defaultAttrsMap
): HtmlVisitor<State> {
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

  const skipLinkRel: any[] = ['preconnect', 'dns-prefetch']

  const visitor: HtmlVisitor = {
    // Avoid resolving the URL of a removed node by
    // waiting for the "close" phase.
    close(path, state) {
      const attrs = attrsMap[path.tagName]
      if (attrs) {
        return path.tagName !== 'link' ||
          !skipLinkRel.includes(path.attributes.rel)
          ? resolve(path, state as any, attrs)
          : undefined
      }
    },
  }

  Object.defineProperty(visitor, kResolverList, {
    value: resolvers,
  })

  return visitor
}
