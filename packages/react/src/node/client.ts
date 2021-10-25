import { ClientProvider } from 'saus/core'

export const getClient: ClientProvider = ({
  renderFn,
  didRenderFn,
  beforeRenderFns,
  extract,
}) => ({
  imports: { 'react-dom': 'ReactDOM' },
  onHydrate: `
    const { rootId = "saus_react" } = request.state
    ReactDOM.hydrate(content, document.getElementById(rootId))
  `,
})
