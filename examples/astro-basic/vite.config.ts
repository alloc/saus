import { copyPublicDir, defineConfig } from 'saus'

export default defineConfig({
  base: '/staging/',
  saus: {
    routes: './src/node/routes.ts',
    render: './src/render.tsx',
    renderConcurrency: 1,
  },
  build: {
    // minify: false,
  },
  plugins: [copyPublicDir()],
})
