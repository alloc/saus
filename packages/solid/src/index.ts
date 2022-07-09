import { defineLayoutRenderer } from 'saus/core'
import { JSX } from 'solid-js/types/jsx'
import { generateHydrationScript, renderToStream } from 'solid-js/web'
import './stack'

export const defineLayout = defineLayoutRenderer<() => JSX.Element>({
  hydrator: '@saus/solid/hydrator',
  serialize: renderToStream,
  head: generateHydrationScript,
})
