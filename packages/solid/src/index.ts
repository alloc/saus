import { defineLayoutRenderer } from 'saus/core'
import { JSX } from 'solid-js/types/jsx'
import { generateHydrationScript, renderToStringAsync } from 'solid-js/web'

export const defineLayout = defineLayoutRenderer<() => JSX.Element>({
  hydrator: '@saus/solid/hydrator',
  toString: renderToStringAsync,
  head: generateHydrationScript,
})
