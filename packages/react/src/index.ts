import reactVite from '@vitejs/plugin-react'
import { configureVite } from 'saus'

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

declare module 'saus' {
  export interface UserConfig {
    babel?: import('@babel/core').TransformOptions
  }
}
