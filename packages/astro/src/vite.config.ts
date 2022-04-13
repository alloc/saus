import { defineConfig, UserConfig } from 'saus/core'
import client from './node/client'
import { astroVite } from './plugin-astro'

export default (config: UserConfig) =>
  defineConfig({
    saus: {
      clients: [client],
    },
    plugins: [astroVite(config.astro)],
  })
