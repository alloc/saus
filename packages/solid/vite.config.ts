import { defineConfig } from 'saus/core'
import solidVite from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solidVite({ ssr: true })],
})
