import * as ReactDOM from 'react-dom'
import { defineHydrator } from 'saus/client'

export default defineHydrator<JSX.Element>((root, content) => {
  ReactDOM.hydrate(content, root)
})
