import { convertToWebp } from '@saus/webp'
import { defineConfig } from 'saus'

export default defineConfig({
  base: '/staging/',
  saus: {
    routes: './src/node/routes.ts',
    bundle: {
      target: 'node16',
      entry: './src/node/server.ts',
      format: 'esm',
      debugBase: '/debug/',
      // minify: true,
    },
    renderConcurrency: 1,
  },
  build: {
    // minify: false,
  },
  plugins: [convertToWebp()],
})
