import { serializeTags } from './serialize'
import { HtmlTagDescriptor } from './types'
import { incrementIndent } from './utils'

const headInjectRE = /([ \t]*)<\/head>/
const headPrependInjectRE = [/([ \t]*)<head>/, /<!doctype html>/i]

export function injectToHead(
  html: string,
  tags: HtmlTagDescriptor[],
  prepend = false
) {
  if (prepend) {
    // inject after head or doctype
    for (const re of headPrependInjectRE) {
      if (re.test(html)) {
        return html.replace(
          re,
          (match, p1) => `${match}\n${serializeTags(tags, incrementIndent(p1))}`
        )
      }
    }
  } else {
    // inject before head close
    if (headInjectRE.test(html)) {
      // respect indentation of head tag
      return html.replace(
        headInjectRE,
        (match, p1) => `${serializeTags(tags, incrementIndent(p1))}${match}`
      )
    }
  }
  // if no <head> tag is present, just prepend
  return serializeTags(tags) + html
}

const bodyInjectRE = /([ \t]*)<\/body>/
const bodyPrependInjectRE = /([ \t]*)<body[^>]*>/

export function injectToBody(
  html: string,
  tags: HtmlTagDescriptor[],
  prepend = false
) {
  if (prepend) {
    // inject after body open
    if (bodyPrependInjectRE.test(html)) {
      return html.replace(
        bodyPrependInjectRE,
        (match, p1) => `${match}\n${serializeTags(tags, incrementIndent(p1))}`
      )
    }
    // if no body, prepend
    return serializeTags(tags) + html
  } else {
    // inject before body close
    if (bodyInjectRE.test(html)) {
      return html.replace(
        bodyInjectRE,
        (match, p1) => `${serializeTags(tags, incrementIndent(p1))}${match}`
      )
    }
    // if no body, append
    return html + `\n` + serializeTags(tags)
  }
}
