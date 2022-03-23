import {
  AttributeAction,
  AttributeSelector,
  parse,
  Selector,
  SelectorType,
} from 'css-what'
import {
  HtmlAttribute,
  HtmlTagPath,
  HtmlTagVisitor,
  HtmlVisitor,
} from './types'

export type HtmlMatcher = (path: HtmlTagPath<any> | undefined) => boolean

/**
 * Create an `HtmlVisitor` from a CSS selector list.
 */
export function $<State>(
  pattern: string,
  visitor: HtmlTagVisitor<State>
): HtmlVisitor<State>

/**
 * Create an `HtmlMatcher` function that tests against `HtmlTagPath` objects.
 */
export function $(pattern: string): HtmlMatcher

/** @internal */
export function $(pattern: string, visitor?: HtmlTagVisitor) {
  const matchers = parse(pattern)
  const match = (
    path: HtmlTagPath | undefined,
    matcher: Selector[]
  ): boolean => {
    if (!path) {
      return false
    }
    for (let i = matcher.length; --i >= 0; ) {
      const selector = matcher[i]
      if (selector.type == SelectorType.Universal) {
        continue
      }
      if (selector.type == SelectorType.Descendant) {
        const parentMatcher = matcher.slice(0, i)
        let parentPath = path.parentPath
        while (parentPath && !match(parentPath, parentMatcher)) {
          parentPath = parentPath.parentPath
        }
        return Boolean(parentPath)
      }
      if (selector.type == SelectorType.Child) {
        return match(path.parentPath, matcher.slice(0, i))
      }
      if (selector.type == SelectorType.Tag) {
        if (path.node.name !== selector.name) {
          return false
        }
      } else if (selector.type == SelectorType.Attribute) {
        const attribute = path.node.attributeMap[selector.name]
        if (!matchAttribute(attribute, selector)) {
          return false
        }
      } else {
        throw Error(`Unsupported selector: ${selector.type}`)
      }
    }
    return true
  }

  if (!visitor) {
    return (path: HtmlTagPath) => matchers.some(matcher => match(path, matcher))
  }

  // These match any tag.
  const anyMatchers: Selector[][] = []
  // These match specific tags.
  const tagMatchers: Record<string, Selector[][]> = {}

  for (const matcher of matchers) {
    let foundTag = false
    for (let i = matcher.length - 1; i >= 0; i--) {
      const selector = matcher[i]
      if (selector.type == SelectorType.Tag) {
        const arr = (tagMatchers[selector.name] ||= [])
        arr.push(matcher)
        foundTag = true
      }
      if (selector.type !== SelectorType.Attribute) {
        break
      }
    }
    if (!foundTag) {
      anyMatchers.push(matcher)
    }
  }

  for (const tagName in tagMatchers) {
    tagMatchers[tagName].push(...anyMatchers)
  }

  if (typeof visitor == 'function') {
    visitor = { open: visitor }
  }

  const { open, close } = visitor
  const wrapper: HtmlVisitor = {}

  let matched: WeakSet<HtmlTagPath>
  if (open) {
    if (close) {
      matched = new WeakSet()
    }
    const matchedOpen = (
      matchers: Selector[][],
      path: HtmlTagPath,
      state: any
    ) => {
      for (const matcher of matchers) {
        if (match(path, matcher)) {
          close && matched.add(path)
          return open(path, state)
        }
      }
    }
    for (const tagName in tagMatchers) {
      const open = matchedOpen.bind(null, tagMatchers[tagName])
      wrapper[tagName] = close ? { open } : open
    }
    if (anyMatchers.length) {
      wrapper.open = matchedOpen.bind(null, anyMatchers)
    }
  }

  if (!close) {
    return wrapper
  }

  if (open) {
    const matchedClose = (path: HtmlTagPath, state: any) => {
      if (matched.delete(path)) {
        return close(path, state)
      }
    }
    for (const tagName in tagMatchers) {
      // @ts-ignore
      wrapper[tagName].close = matchedClose
    }
    if (anyMatchers.length) {
      wrapper.close = matchedClose
    }
  } else {
    const matchedClose = (
      matchers: Selector[][],
      path: HtmlTagPath,
      state: any
    ) => {
      for (const matcher of matchers) {
        if (match(path, matcher)) {
          return close(path, state)
        }
      }
    }
    for (const tagName in tagMatchers) {
      wrapper[tagName] = {
        close: matchedClose.bind(null, tagMatchers[tagName]),
      }
    }
    if (anyMatchers.length) {
      wrapper.close = matchedClose.bind(null, anyMatchers)
    }
  }

  return wrapper
}

function matchAttribute(
  attribute: HtmlAttribute | undefined,
  selector: AttributeSelector
) {
  if (selector.action == AttributeAction.Exists) {
    return Boolean(attribute)
  }
  if (!attribute || !attribute.value) {
    return false
  }
  const { value } = attribute.value
  return selector.action == AttributeAction.Element
    ? value.split(' ').includes(selector.value)
    : selector.action == AttributeAction.Equals
    ? value === selector.value
    : selector.action == AttributeAction.Start
    ? value.startsWith(selector.value)
    : selector.action == AttributeAction.End
    ? value.endsWith(selector.value)
    : selector.action == AttributeAction.Any
    ? value.includes(selector.value)
    : inlineThrow(Error(`Unsupported attribute selector: ${selector.action}`))
}

function inlineThrow(e: Error): never {
  throw e
}
