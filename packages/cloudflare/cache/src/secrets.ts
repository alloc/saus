import { defineSecrets } from 'saus/deploy'

export default defineSecrets({
  apiKey: 'CLOUDFLARE_API_TOKEN',
  email: 'CLOUDFLARE_EMAIL',
})
