import { BASE_URL } from './baseUrl'
import { injectLinkTag } from './head'

export function preloadModules(urls: string[]) {
  for (const url of urls)
    injectLinkTag(
      BASE_URL + url,
      url.endsWith('.css') ? 'stylesheet' : undefined
    )
}
