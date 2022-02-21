import { defineConfig } from 'saus'
import sausTest from '@saus/test'

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
  build: {
    // minify: false,
  },
  // Once you put "types": ["@saus/react"] in your tsconfig.json,
  // you can customize Babel like this:
  babel: {},
  // Run "saus test" to blow your mind.
  testFramework: sausTest(),
})
