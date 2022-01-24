import { addConfigHook } from 'saus/core'

export * from './node'
export { beforeRender } from 'saus/core'

addConfigHook('./vite.config')

declare module 'saus/core' {
  export interface UserConfig {
    babel?: import('@babel/core').TransformOptions
    react?: Omit<import('@vitejs/plugin-react').Options, 'babel'>
  }
}
