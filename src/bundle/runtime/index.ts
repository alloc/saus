// Redirect "saus" imports here.
export { render } from '../../render'
export { route } from '../../routes'
export { getPageFilename } from '../../pages'

import * as html from '../../html'
import { context } from './context'
import config from './config'

export const transformHtml = /* #__PURE__ */ wrapHtmlHook(html.transformHtml)
export const resolveHtmlImports = /* #__PURE__ */ wrapHtmlHook(
  html.resolveHtmlImports
)

/**
 * Lazily import the `src/core/html` module, as it adds something like
 * 10kb to the SSR bundle. This lets us tree-shake it when no HTML hooks
 * are called in the user's `routes` module.
 */
function wrapHtmlHook<T extends (...args: any[]) => any>(hook: T): T {
  return ((...args: any) => {
    context.transformHtml ??= async (html, page) => {
      const { transformHtml } = await import('../../core/html')
      const { visitors } = context
      return (context.transformHtml = (html, page) =>
        transformHtml(html, { page, config }, visitors!))(html, page)
    }
    return hook(...args)
  }) as T
}
