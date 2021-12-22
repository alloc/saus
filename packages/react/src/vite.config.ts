import reactVite from '@vitejs/plugin-react'
import { defineConfig, UserConfig } from 'saus/core'
import client from './node/client'

export default (config: UserConfig) =>
  defineConfig({
    saus: {
      clients: [client],
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
      exclude: ['@saus/react'],
    },
    plugins: [
      reactVite({
        ...config.react,
        babel: config.babel,
      }),
    ],
  })
