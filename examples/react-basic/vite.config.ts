import { defineConfig } from 'saus'

export default defineConfig({
  base: '/staging/',
  saus: {
    routes: './src/node/routes.ts',
    render: './src/render.tsx',
    bundle: {
      target: 'node16',
      entry: './src/node/server.ts',
      format: 'esm',
      debugBase: '/debug/',
      // minify: true,
    },
  },
  test: {
    frameworkPath: '@saus/test',
  },
  build: {
    // minify: false,
  },
  // Once you put "types": ["@saus/react"] in your tsconfig.json,
  // you can customize Babel like this:
  babel: {},
})
