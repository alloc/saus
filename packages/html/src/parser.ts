import {
  HtmlAttribute,
  HtmlAttributeValue,
  HtmlComment,
  HtmlNode,
  HtmlTag,
  HtmlText,
} from './types'

// An ">" or "/" signal the end of a tag name or attribute list.
// This also returns false when HTML abruptly ends.
let notClosed = (char: string | undefined) => '>/'.indexOf(char || '') < 0

// Spaces, tabs, and line breaks all end an identifier.
let notSpaced = (char: string) => /\S/.test(char)

export function parseHtml(html: string) {
  let pos = -1
  let stack: (HtmlTag | undefined)[] = []
  let wip: HtmlTag | undefined
  let body: (HtmlTag | HtmlText | HtmlComment)[] = []
  let document: (HtmlTag | HtmlComment)[] = []

  let appendTo = (node: HtmlTag | HtmlComment | HtmlText, parent = wip) =>
    (parent ? body : (document as typeof body)).push(node)

  while (++pos < html.length) {
    let char = html[pos]

    // A tag is being declared.
    if (char == '<') {
      if (wip) {
        // Text between two tags
        let start = (body[body.length - 1] || wip.open).end
        start < pos &&
          appendTo({
            type: 'Text',
            start,
            end: pos,
            value: html.slice(start, pos),
          })
      }

      // Closing tag like </div>
      if (wip && html[pos + 1] == '/') {
        wip.close = { start: pos } as HtmlNode
        continue
      }

      // Tag might be an HTML comment
      let start = pos + 4
      let rawName = html.slice(pos + 1, start)
      if (rawName == '!--') {
        let end = html.indexOf('-->', start)
        appendTo({
          type: 'Comment',
          value: html.slice(start, end),
          start: pos,
          end: (pos = end + 2) + 1,
        })
      } else {
        start = pos
        rawName = ''
        while (notClosed(html[pos + 1]) && notSpaced(html[++pos])) {
          rawName += html[pos]
        }
        stack.push(wip)
        parseAttributes(
          (wip = {
            type: 'Tag',
            start,
            open: { start } as HtmlNode,
            name: rawName.toLowerCase(),
            rawName,
            attributes: [] as HtmlAttribute[],
            attributeMap: {},
          } as HtmlTag)
        )
      }
    }
    // A tag is ending.
    else if (char == '>' && wip) {
      let done: any = false

      // Opening tag like <div> or <div/>
      if (!wip.open.end) {
        wip.open.end = pos + 1

        // Assume "/>" never has a space between / and >
        done = html[pos - 1] == '/' || selfClosingTags.has(wip.name)
      }
      // Closing tags like </div>
      else if ((done = wip.close)) {
        wip.close.end = pos + 1
      }

      // Tag is completed, now append to its parent
      if (done) {
        let parent = stack.pop()
        if (body.length) {
          wip.body = body
          body = (parent && parent.body) || []
        }
        wip.end = pos + 1
        appendTo(wip, (wip = parent))
      }
    }
  }

  return document

  function parseAttributes(wip: HtmlTag) {
    while (notClosed(html[pos + 1])) {
      let rawName = html[++pos]
      // Attribute names cannot start with space or hyphen
      if (notSpaced(rawName) && rawName != '-') {
        let name = { type: 'Text' as const, start: pos } as HtmlText
        let value: HtmlAttributeValue | undefined

        // Assume no whitespace between attribute name
        // and the "=" that comes after (if one exists).
        while (notClosed(html[pos + 1]) && notSpaced(html[pos + 1])) {
          let char = html[++pos]
          if (char == '=') {
            name.end = pos

            // Assume quote immediately follows "="
            let quote = html[++pos] as "'" | '"'
            let findQuote = (): number =>
              html[++pos] == quote ? pos : findQuote()

            value = {
              start: pos,
              value: html.slice(pos + 1, findQuote()),
              quote,
              // Define this after `findQuote` is called.
              end: pos + 1,
            }
          } else {
            rawName += char
          }
        }

        name.end ||= pos + 1
        name.value = rawName
        wip.attributes.push(
          (wip.attributeMap[rawName] = {
            start: name.start,
            end: pos + 1,
            name,
            value,
          })
        )
      }
    }
  }
}

let selfClosingTags = new Set([
  '!--',
  '!doctype',
  'area',
  'base',
  'br',
  'col',
  'command',
  'embed',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])
