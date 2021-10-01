import { configureVite } from 'saus'
import reactVite from '@vitejs/plugin-react'
import './global'

export * from './render'

configureVite(config => {
  config.plugins!.push(
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
