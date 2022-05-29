import path from 'path'
import voidTags from 'html-tags/void'
// import htmlTags from 'html-tags'

export function createTagLib(componentFiles) {
  const components = {}
  for (const filePath of componentFiles) {
    const tagName = path.basename(filePath, '.marko')
    components[tagName] = filePath
  }

  return {
    locateTag(tagName) {
      const filePath = components[tagName] || ''
      return {
        filePath,
        parseOptions: {
          openTagOnly: voidTags.includes(tagName),
        },
        parser: undefined,
      }
    },
  }
}
