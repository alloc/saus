import solid, { Options } from 'vite-plugin-solid'
import { configureVite } from 'saus/core'

export * from './node/render'
export { beforeRender } from 'saus/core'

configureVite(config => ({
  optimizeDeps: {
    include: ['solid-js'],
    exclude: ['@saus/solid'],
  },
  plugins: [
    solid({
      babel: config.babel,
      solid: config.solid,
    }),
  ],
}))

declare module 'saus/core' {
  export interface UserConfig {
    babel?: Options['babel']
    solid?: Options['solid']
  }
}
