export function preloadModule(href: string) {
  const isCss = href.endsWith('.css')
  const cssRel = isCss ? '[rel="stylesheet"]' : ''
  if (!document.querySelector(`link[href="${href}"]${cssRel}`)) {
    const link = document.createElement('link')
    link.rel = isCss ? 'stylesheet' : 'modulepreload'
    link.href = href
    document.head.appendChild(link)
  }
}
