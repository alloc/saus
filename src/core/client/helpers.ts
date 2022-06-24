import { describeHead, injectLinkTag } from './head'

export function preloadModules(urls: string[]) {
  for (const url of urls)
    injectLinkTag(url, url.endsWith('.css') ? 'stylesheet' : undefined)
}

export { describeHead }
export { resolveModules } from '../utils/resolveModules'
