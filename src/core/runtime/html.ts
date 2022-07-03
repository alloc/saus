import { escape } from '../utils/escape'
import { Falsy } from '../utils/types'

export function html(
  staticHtml: TemplateStringsArray,
  ...slots: any[]
): UnsafeHTML {
  if (slots.length === 0) {
    return unsafeHTML(staticHtml[0].trim())
  }

  let out = ''

  const append = (value: any) => {
    if (Array.isArray(value)) {
      return value.forEach(append)
    }
    if (value) {
      let html = value[kUnsafeHtml] || escape(value + '')
      if (out[out.length - 1] == '=') {
        html = `"${html}"`
      }
      out += html
    }
  }

  staticHtml.forEach((html, i) => {
    out += html
    append(slots[i])
  })

  return unsafeHTML(out.trim())
}

const kUnsafeHtml = Symbol.for('unsafe-html')

class UnsafeHtmlString extends String {
  get [kUnsafeHtml]() {
    return this.toString()
  }
}

function unsafeHTML(html: string) {
  return new UnsafeHtmlString(html) as UnsafeHTML
}

export type UnsafeHTML = string & UnsafeHtmlString

export const unsafe: {
  /** Like `html` but dynamic data isn't escaped. */
  html(staticHtml: TemplateStringsArray, ...slots: any[]): UnsafeHTML
  /** Wrap a string so it's not escaped by `html` call. */
  html(staticHtml: string): UnsafeHTML
  /** Wrap a string so it's not escaped by `html` call. */
  html(staticHtml: string | Falsy): UnsafeHTML | Falsy
} = {
  html(
    staticHtml: string | TemplateStringsArray | Falsy,
    ...slots: any[]
  ): any {
    return (
      staticHtml &&
      (typeof staticHtml == 'string'
        ? unsafeHTML(staticHtml)
        : html(staticHtml, ...slots.map(unsafeHTML)))
    )
  },
}
