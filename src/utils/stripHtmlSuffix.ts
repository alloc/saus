const htmlExtensionRE = /\.html(\?|$)/
const indexHtmlSuffixRE = /\/index.html(\?|$)/

export function stripHtmlSuffix(url: string) {
  if (!url) {
    return url
  }
  if (url[0] !== '/') {
    url = '/' + url
  }
  if (indexHtmlSuffixRE.test(url)) {
    return url.replace(indexHtmlSuffixRE, '/$1')
  }
  return url.replace(htmlExtensionRE, '$1')
}
