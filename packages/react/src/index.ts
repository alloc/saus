import reactVite from '@vitejs/plugin-react'
import { configureVite } from 'saus'

export * from './node/render'

configureVite(config => {
  config.plugins ??= []
  config.plugins.push(
    reactVite({
      babel: config.babel,
    })
  )
})

declare module 'saus' {
  export interface UserConfig {
    babel?: import('@babel/core').TransformOptions
  }
}
