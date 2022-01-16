declare const document: any

export function preloadModules(urls: string[]) {
  for (const url of urls) {
    const isCss = url.endsWith('.css')
    const cssRel = isCss ? '[rel="stylesheet"]' : ''
    if (!document.querySelector(`link[href="${url}"]${cssRel}`)) {
      const link = document.createElement('link')
      link.rel = isCss ? 'stylesheet' : 'modulepreload'
      link.href = url
      document.head.appendChild(link)
    }
  }
}

export { resolveModules } from '../utils/resolveModules'
