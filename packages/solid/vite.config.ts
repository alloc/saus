import { defineConfig } from 'saus'
import solidVite from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solidVite({ ssr: true })],
})
