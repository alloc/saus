import reactVite from '@vitejs/plugin-react'
import { defineConfig } from 'saus/core'

export default defineConfig({
  ssr: {
    external: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  plugins: [reactVite()],
})
