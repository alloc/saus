import { ReactElement } from 'react'
import { hydrate } from 'react-dom'
import { defineHydrator } from 'saus/client'

export default defineHydrator<ReactElement>((root, content) => {
  hydrate(content, root)
})
