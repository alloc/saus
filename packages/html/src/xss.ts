import MagicString from 'magic-string'
import { HtmlTag } from './types'
import allow from './xss/allow'

export function sanitizeTag(tag: HtmlTag, editor: MagicString) {
  const allowedAttrs = allow[tag.name]
  if (!allowedAttrs) {
    editor.remove(tag.start, tag.end)
    return
  }
  for (const attr of tag.attributes) {
    if (!allowedAttrs.includes(attr.name.value)) {
      editor.remove(attr.start, attr.end)
    }
  }
}
