export interface HeadDescription {
  title?: string
  stylesheet?: string[]
  prefetch?: string[]
  preload?: string[]
}

const headCache: Record<string, HeadDescription> = {}

export function describeHead(pagePath: string, head: HeadDescription) {
  headCache[pagePath] = head
}

const linkTypes = ['stylesheet', 'prefetch', 'preload'] as const

export function applyHead(pagePath: string) {
  const head = headCache[pagePath]
  if (head) {
    if (head.title) {
      document.title = head.title
    }
    for (const rel of linkTypes) {
      head[rel]?.forEach(url => injectLinkTag(url, rel))
      delete head[rel]
    }
  }
}

export function injectLinkTag(url: string, rel?: string) {
  let selector = `link[href="${url}"]`
  if (rel) {
    selector += `[rel="${rel}"]`
  }
  if (!document.head.querySelector(selector)) {
    const link = document.createElement('link')
    // TODO: do feature detection for modulepreload?
    link.rel = rel || 'modulepreload'
    const asIndex = url.indexOf('\t')
    if (~asIndex) {
      link.href = url.slice(0, asIndex)
      link.as = url.slice(asIndex + 1)
    } else {
      link.href = url
    }
    document.head.appendChild(link)
  }
}
