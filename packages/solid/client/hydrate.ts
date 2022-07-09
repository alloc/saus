import { defineHydrator } from 'saus/client'
import { JSX } from 'solid-js/types/jsx'
import { hydrate } from 'solid-js/web'

export default defineHydrator<() => JSX.Element>((root, content) => {
  hydrate(content, root)
})
