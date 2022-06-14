import { crawl } from 'recrawl-sync'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: crawl('src', {
    only: ['*.ts'],
    skip: ['*.spec.*'],
    absolute: true,
  }),
  format: ['cjs', 'esm'],
  bundle: false,
})
