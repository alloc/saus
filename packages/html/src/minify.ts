import { processHtml, setup } from 'saus/core'

type MinifyOptions = {
  /** Minify in development too */
  force?: boolean
  /** Transform `<script>` content */
  transformScript?: (code: string) => string
  /** Transform `<style>` content */
  transformStyle?: (css: string) => string
}

/**
 * An ultra lightweight means of minifying the HTML of each page.
 * By default, this hook does nothing when `saus dev` is used.
 */
export const minifyHtml = (options: MinifyOptions = {}) =>
  setup(
    env =>
      (options.force || env.command !== 'dev') &&
      processHtml('post', {
        name: 'minifyHtml',
        process: createMinifier(options),
      })
  )

const commentOpen = '<!-- '
const commentClose = ' -->'

function createMinifier(options: MinifyOptions) {
  return (html: string) => {
    const splices: [number, number, string?][] = []
    const codeTags = parseCodeTags(html)
    if (options.transformScript) {
      for (const tag of codeTags) {
        if (tag.name == 'script')
          splices.push([
            tag.open.end,
            tag.close.start,
            options.transformScript(html.slice(tag.open.end, tag.close.start)),
          ])
      }
    }
    if (options.transformStyle) {
      for (const tag of codeTags) {
        if (tag.name == 'style')
          splices.push([
            tag.open.end,
            tag.close.start,
            options.transformStyle(html.slice(tag.open.end, tag.close.start)),
          ])
      }
    }
    const needSort = splices.length > 0
    const pattern = /(?:(^|>)\s+([^\s])|([^\s])\s+(<|$))/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(html))) {
      const left = match[1] ?? match[3]
      const right = match[2] ?? match[4]
      const start = match.index + (left == '' ? 0 : 1)
      const container = codeTags.find(tag => tag.close.end > start)
      if (container && container.open.end < start) {
        continue // Skip whitespace within <script> and <style> tags.
      }
      const end = pattern.lastIndex - (right == '' ? 0 : 1)
      if (right == '<') {
        const offset = pattern.lastIndex - 1
        if (commentOpen == html.substr(offset, commentOpen.length)) {
          continue // Preserve whitespace before comment.
        }
      } else {
        pattern.lastIndex--
      }
      if (left == '>') {
        const offset = -commentClose.length + match.index + 1
        if (commentClose == html.substr(offset, commentClose.length)) {
          continue // Preserve whitespace after comment.
        }
      }
      splices.push([start, end])
    }
    if (needSort) {
      splices.sort((a, b) => a[0] - b[0])
    }
    let newHtml = ''
    let lastEnd = 0
    for (const [start, end, insertion = ''] of splices) {
      newHtml += html.slice(lastEnd, start) + insertion
      lastEnd = end
    }
    newHtml += html.slice(lastEnd)
    return newHtml
  }
}

interface Position {
  start: number
  end: number
}

interface Tag {
  name: string
  open: Position
  close: Position
}

function parseCodeTags(html: string) {
  const tags: Tag[] = []
  const tagRegex = /\<(\/)?(script|style)[^>]*(\/)?\>/g
  let openTag: Partial<Tag> | undefined
  let match: RegExpExecArray | null
  while ((match = tagRegex.exec(html))) {
    // Skip self-closing tags.
    if (match[3]) {
      continue
    }
    const tagStart = match.index
    const tagEnd = tagRegex.lastIndex
    if (match[1]) {
      if (!openTag || openTag.name !== match[2]) {
        continue
      }
      openTag.close = {
        start: tagStart,
        end: tagEnd,
      }
      tags.push(openTag as Tag)
      openTag = undefined
    } else if (!openTag) {
      openTag = {
        name: match[2],
        open: {
          start: tagStart,
          end: tagEnd,
        },
      }
    }
  }
  return tags
}

if (import.meta.vitest) {
  const { expect, describe, it } = import.meta.vitest

  const process = createMinifier({})
  describe('minifyHtml', () => {
    it('preserves whitespace around HTML comment', () => {
      expect(process('<body> x <!-- --> x </body>')).toMatchInlineSnapshot(
        '"<body>x <!-- --> x</body>"'
      )
    })
  })

  describe('parseCodeTags', () => {
    it('ignores self-closing script', () => {
      expect(parseCodeTags('<script src="foo.js" />').length).toBe(0)
    })
    it('parses script tags', () => {
      expect(
        parseCodeTags(`
<script>
  console.log("hi")
</script>
<script></script>
      `)
      ).toMatchInlineSnapshot(`
        [
          {
            "close": {
              "end": 39,
              "start": 30,
            },
            "name": "script",
            "open": {
              "end": 9,
              "start": 1,
            },
          },
          {
            "close": {
              "end": 57,
              "start": 48,
            },
            "name": "script",
            "open": {
              "end": 48,
              "start": 40,
            },
          },
        ]
      `)
    })
    it('parses style tags', () => {
      const html = `
<style type="text/css">div { display: flex }</style>
<style>
  body {
    font-size: 16px;
  }
</style>
  `
      const tags = parseCodeTags(html)
      expect(tags.length).toMatchInlineSnapshot('2')
      expect(
        html.slice(tags[0].open.end, tags[0].close.start)
      ).toMatchInlineSnapshot('"div { display: flex }"')
      expect(html.slice(tags[1].open.end, tags[1].close.start))
        .toMatchInlineSnapshot(`
        "
          body {
            font-size: 16px;
          }
        "
      `)
    })
  })
}
