import { defineConfig, UserConfig } from 'saus/core'
import client from './node/client'
import { astroVite, ssrRuntimeId } from './plugin-astro'

export default (config: UserConfig) =>
  defineConfig({
    plugins: [astroVite(config.astro)],
    saus: {
      clients: [client],
    },
    optimizeDeps: {
      exclude: [ssrRuntimeId],
    },
  })
