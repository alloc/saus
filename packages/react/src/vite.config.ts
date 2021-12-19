import reactVite from '@vitejs/plugin-react'
import { defineConfig, UserConfig } from 'saus/core'

export default (config: UserConfig) =>
  defineConfig({
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
