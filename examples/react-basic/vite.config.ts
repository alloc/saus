import { defineConfig } from 'saus'

export default defineConfig({
  base: '/staging/',
  saus: {
    routes: './src/node/routes.ts',
    render: './src/render.tsx',
    bundle: {
      entry: './src/node/server.ts',
      format: 'esm',
    },
  },
  // Once you put "types": ["@saus/react"] in your tsconfig.json,
  // you can customize Babel like this:
  babel: {},
})
