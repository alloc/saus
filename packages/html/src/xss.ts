import MagicString from 'magic-string'
import { HtmlTag } from './types'
import allow from './xss/allow'

/**
 * When the given `tag` is not allowed, `false` is returned
 * and the tag is removed from the given `MagicString` object.
 *
 * Otherwise, the tag's attributes are checked, and disallowed
 * attributes are removed.
 */
export function sanitizeTag(tag: HtmlTag, editor: MagicString) {
  const allowedAttrs = allow[tag.name]
  if (!allowedAttrs) {
    editor.remove(tag.start, tag.end)
    return false
  }
  for (const attr of tag.attributes) {
    if (!allowedAttrs.includes(attr.name.value)) {
      editor.remove(attr.start, attr.end)
    }
  }
  return true
}
