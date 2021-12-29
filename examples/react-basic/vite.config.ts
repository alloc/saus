import { defineConfig } from 'saus'

export default defineConfig({
  base: '/staging/',
  saus: {
    bundle: { format: 'esm' },
  },
  // Once you put "types": ["@saus/react"] in your tsconfig.json,
  // you can customize Babel like this:
  babel: {},
})
