import { defineSecrets } from 'saus/deploy'

export const secrets = defineSecrets({
  apiToken: 'CLOUDFLARE_API_TOKEN',
})
