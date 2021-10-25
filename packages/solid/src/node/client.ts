import { ClientProvider } from 'saus/core'

export const getClient: ClientProvider = () => ({
  imports: { 'solid-js/web': ['hydrate'] },
  onHydrate: `
    const { rootId = "saus_solid" } = request.state
    hydrate(content, document.getElementById(rootId))
  `,
})
