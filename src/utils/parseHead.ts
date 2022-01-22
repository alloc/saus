import type { HeadDescription } from '../client/head'

const linkTypes = ['stylesheet', 'prefetch', 'preload']

export function parseHead(html: string): HeadDescription | undefined {
  let match = /<head\b[^>]*>([\s\S]*)?<\/head>/.exec(html)
  if (!match) {
    return
  }

  let title: string | undefined
  const linkTags: Record<string, string[]> = {}

  const headHtml = match[1]
  const headTagRE = /<(title|link)\b([\s\S]*?)\/?>/g
  while ((match = headTagRE.exec(headHtml))) {
    if (match[1] == 'title') {
      match = /^([\s\S]*?)<\/title>/.exec(headHtml.slice(headTagRE.lastIndex))
      if (match) {
        title = match[1]
      }
    } else {
      const props: Record<string, string> = {}

      const linkTag = match[2]
      const attributeRE = /\b(rel|href|as)=["']([^"']+)["']/g
      while ((match = attributeRE.exec(linkTag))) {
        props[match[1]] = match[2]
      }

      if (linkTypes.includes(props.rel)) {
        const tags = (linkTags[props.rel] ||= [])
        tags.push(props.href + (props.as ? '\t' + props.as : ''))
      }
    }
  }

  if (title !== undefined || Object.keys(linkTags).length)
    return {
      title,
      ...linkTags,
    }
}
