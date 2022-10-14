export type ParsedHeadTag<T = any> = { value: T; start: number; end: number }
export type ParsedHead = {
  title?: ParsedHeadTag<string>
  stylesheet: ParsedHeadTag<string>[]
  prefetch: ParsedHeadTag<string>[]
  preload: { [as: string]: ParsedHeadTag<string>[] }
}

export function parseHead(html: string): ParsedHead {
  const head: ParsedHead = {
    title: undefined,
    stylesheet: [],
    prefetch: [],
    preload: {},
  }

  let match = /<head\b[^>]*>[\s\S]*<\/head>/.exec(html)
  if (match) {
    const headStart = match.index
    const headHtml = match[0]
    const headTagRE = /<(title|link)\b([\s\S]*?)\/?>/g
    while ((match = headTagRE.exec(headHtml))) {
      const start = headStart + match.index
      if (match[1] == 'title') {
        match = /^([\s\S]*?)<\/title>/.exec(headHtml.slice(headTagRE.lastIndex))
        if (match) {
          const end = headStart + headTagRE.lastIndex + match[0].length
          head.title = { value: match[1], start, end }
        }
      } else {
        const props: Record<string, string> = {}

        const linkTag = match[2]
        const attributeRE = /\b(rel|href|as)=["']([^"']+)["']/g
        while ((match = attributeRE.exec(linkTag))) {
          props[match[1]] = match[2]
        }

        if (!shouldParseLink(props.rel)) {
          continue
        }

        const linkTags =
          props.rel == 'preload'
            ? (head.preload[props.as] ||= [])
            : head[props.rel]

        const end = headStart + headTagRE.lastIndex
        linkTags.push({ value: props.href, start, end })
      }
    }
  }

  return head
}

const parsedLinkTypes = ['stylesheet', 'prefetch', 'preload'] as const

type ParsedLinkType = typeof parsedLinkTypes[number]

function shouldParseLink(rel: string): rel is ParsedLinkType {
  return parsedLinkTypes.includes(rel as any)
}
