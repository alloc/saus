import { defineClient, endent } from 'saus/core'

export default defineClient({
  imports: { 'react-dom': 'ReactDOM' },
  onHydrate: endent`
    const { rootId = "saus_react" } = request.props
    ReactDOM.hydrate(content, document.getElementById(rootId))
  `,
})
