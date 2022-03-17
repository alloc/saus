export interface HeadDescription {
  title?: string
  stylesheet?: string[]
  prefetch?: string[]
  preload?: { [as: string]: string[] }
}

const headCache: Record<string, HeadDescription> = {}

export function describeHead(pagePath: string, head: HeadDescription) {
  headCache[pagePath] = head
}

export function applyHead(pagePath: string) {
  const head = headCache[pagePath]
  if (head) {
    if (head.title) {
      document.title = head.title
    }
    for (const rel of ['stylesheet', 'prefetch'] as const) {
      head[rel]?.forEach(url => injectLinkTag(url, rel))
      delete head[rel]
    }
    if (head.preload) {
      for (const as in head.preload) {
        head.preload[as].forEach(url => injectLinkTag(url, 'preload', as))
      }
      delete head.preload
    }
  }
}

export function injectLinkTag(url: string, rel?: string, as?: string) {
  // Convert "&amp;" to "&" etc
  url = htmlDecode(url)

  let selector = `link[href="${url}"]`
  if (rel) {
    selector += `[rel="${rel}"]`
  }

  if (!document.head.querySelector(selector)) {
    const link = document.createElement('link')
    if (as) {
      link.as = as
    }
    // TODO: do feature detection for modulepreload?
    link.rel = rel || 'modulepreload'
    link.href = url
    document.head.appendChild(link)
  }
}

const htmlDecoder = document.createElement('textarea')
const htmlDecode = (text: string) => {
  htmlDecoder.innerHTML = text
  return htmlDecoder.value
}
