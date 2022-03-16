import { defineConfig } from 'tsup'
import { crawl } from 'recrawl-sync'

export default defineConfig({
  entry: crawl('src', {
    only: ['*.ts'],
    skip: ['*.spec.*', 'test.ts'],
    absolute: true,
  }),
  format: ['cjs', 'esm'],
  bundle: false,
  sourcemap: true,
  minifySyntax: true,
  define: {
    'import.meta.vitest': 'false',
  },
})
