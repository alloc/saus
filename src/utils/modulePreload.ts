import type { HtmlTagDescriptor } from 'vite'

export function getPreloadTagsForModules(
  moduleUrls: Iterable<string>,
  headTags: HtmlTagDescriptor[]
) {
  for (const moduleUrl of moduleUrls) {
    headTags.push({
      injectTo: 'head',
      tag: 'link',
      attrs: {
        rel: 'modulepreload',
        href: moduleUrl,
      },
    })
  }
}
