import { addConfigHook } from 'saus/core'

// export { beforeRender } from 'saus/core'
// export * from './node'

addConfigHook('./vite.config')

declare module 'saus/core' {
  export interface UserConfig {
    astro?: any
  }
}
