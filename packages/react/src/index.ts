import { addConfigHook } from 'saus/core'

export { beforeRender } from 'saus/core'
export * from './node'
export * from './types'

addConfigHook('./vite.config')

declare module 'saus/core' {
  export interface UserConfig {
    babel?: import('@babel/core').TransformOptions
    react?: Omit<import('@vitejs/plugin-react').Options, 'babel'>
  }
}
