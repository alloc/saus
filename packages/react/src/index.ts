import reactVite from '@vitejs/plugin-react'
import { configureVite } from 'saus/core'

export * from './node/render'

configureVite(config => ({
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: ['@saus/react'],
  },
  plugins: [
    reactVite({
      babel: config.babel,
    }),
  ],
}))

declare module 'saus/core' {
  export interface UserConfig {
    babel?: import('@babel/core').TransformOptions
  }
}
