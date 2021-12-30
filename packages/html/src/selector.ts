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

export type HtmlSelector = Required<Pick<HtmlVisitor, 'open'>>

/**
 * Create an `HtmlVisitor` from a CSS selector list.
 *
 * The `onMatch` function is called before descendants are traversed.
 */
export function $(pattern: string, visitor: HtmlTagVisitor): HtmlSelector {
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

  const { open, close } = expandVisitFn()

  const matchers = parse(pattern)
  return {
    open(path, state) {
      for (const matcher of matchers) {
        if (match(path, matcher)) {
          return visitor(path, state)
        }
      }
    },
  }
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
