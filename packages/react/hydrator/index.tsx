import * as ReactDOM from 'react-dom'
import { defineHydrator } from 'saus/client'

export default defineHydrator<JSX.Element | null>((root, content) => {
  ReactDOM.hydrate(content, root)
})
