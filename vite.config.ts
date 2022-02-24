import { defineConfig } from 'saus'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  saus: {
    routes: 'src/node/routes.ts',
    render: 'src/render.tsx',
    bundle: {
      debugBase: '/.debug/',
    },
  },
  plugins: [tsconfigPaths()],
})
