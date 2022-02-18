import { processHtml, setup } from 'saus/core'

/**
 * An ultra lightweight means of minifying the HTML of each page.
 * By default, this hook does nothing when `saus dev` is used.
 */
export const minifyHtml = (
  options: {
    /** Minify in development too */
    force?: boolean
  } = {}
) =>
  setup(
    env =>
      (options.force || env.command !== 'dev') &&
      processHtml('post', {
        name: 'minifyHtml',
        process: html =>
          html
            .replace(/(^|>)\s+([^\s])/g, '$1$2')
            .replace(/([^\s])\s+(<|$)/g, '$1$2'),
      })
  )
