import { BASE_URL } from './baseUrl'
import { describeHead, injectLinkTag } from './head'

export function preloadModules(urls: string[]) {
  for (const url of urls)
    injectLinkTag(
      BASE_URL + url,
      url.endsWith('.css') ? 'stylesheet' : undefined
    )
}

export { resolveModules } from '../utils/resolveModules'
export { describeHead }
