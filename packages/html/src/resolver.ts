import { EnforcementPhase, findHtmlProcessor } from 'saus/core'
import { kVisitorsArray } from './symbols'
import { findTraverseVisitor, traverseHtml } from './traversal'
import {
  HtmlResolver,
  HtmlResolverState,
  HtmlTagPath,
  HtmlVisitor,
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

  const traversePlugin = findTraverseVisitor(enforce)
  if (traversePlugin) {
    visitor = traversePlugin.process[kVisitorsArray].find(
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
export function createHtmlResolver<State extends HtmlResolver.BaseState = {}>(
  resolver: HtmlResolver<State>,
  attrsMap = defaultAttrsMap
): HtmlVisitor<State> {
  let elapsedTime = 0

  const resolvers = [resolver]
  const resolve = async (
    path: HtmlTagPath<State>,
    state: Partial<HtmlResolverState<State>>,
    attrs: string[]
  ) => {
    const time = Date.now()
    const importer = state.page!.path
    for (const attr of attrs) {
      const id = path.attributes[attr]
      if (typeof id !== 'string') {
        continue
      }
      state.tag = path
      state.attr = attr
      for (const resolveId of resolvers) {
        const resolvedId = await resolveId(id, importer, state as any)
        if (resolvedId != null) {
          path.setAttribute(attr, resolvedId)
          break
        }
      }
      delete state.tag
      delete state.attr
    }
    elapsedTime += Date.now() - time
  }

  const skipLinkRel: any[] = ['preconnect', 'dns-prefetch']

  const visitor: HtmlVisitor<State> = {
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
    html: {
      close() {
        console.log('resolve links:', elapsedTime + 'ms')
        elapsedTime = 0
      },
    },
  }

  Object.defineProperty(visitor, kResolverList, {
    value: resolvers,
  })

  return visitor
}
