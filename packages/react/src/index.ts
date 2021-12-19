import { configureVite } from 'saus/core'

export * from './node/render'
export { beforeRender } from 'saus/core'

configureVite('./vite.config')

declare module 'saus/core' {
  export interface UserConfig {
    babel?: import('@babel/core').TransformOptions
    react?: Omit<import('@vitejs/plugin-react').Options, 'babel'>
  }
}
