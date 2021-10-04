import reactVite from '@vitejs/plugin-react'
import { configureVite } from 'saus'

export * from './node/render'

configureVite(config => ({
  plugins: [
    reactVite({
      babel: config.babel,
    }),
  ],
}))

declare module 'saus' {
  export interface UserConfig {
    babel?: import('@babel/core').TransformOptions
  }
}
