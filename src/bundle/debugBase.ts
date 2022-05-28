import { createHtmlResolver, createVisitor } from '@saus/html'
import config from './runtimeConfig'

/**
 * Scan the `<body>` tree for internal links to be rewritten
 * so they point to the debug-view equivalent URL.
 */
export function injectDebugBase(
  debugBase: string
): (html: string, state: any) => Promise<string> {
  const resolver = createHtmlResolver(
    id =>
      id.startsWith(config.base) && !id.startsWith(debugBase)
        ? id.replace(config.base, debugBase)
        : null,
    // Rewrite anchor elements only.
    { a: ['href'] }
  )
  return createVisitor({
    body(body) {
      body.traverse(resolver)
    },
  })
}
