# @saus/cloudflare-request

```ts
import { createRequestFn } from '@saus/cloudflare-request'

const request = createRequestFn({
  // Get a token here: https://dash.cloudflare.com/profile/api-tokens
  apiToken: '**********',
  // Usually a Vite logger is passed here.
  logger: { info: console.log },
})

const resp = await request('get', '/zones/cd7d0123e3012345da9420df9514dad0')
console.log(resp.toJSON())
```
