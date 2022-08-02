import { createRequestFn, secrets } from '@saus/cloudflare-request'
import { PurgePlugin } from 'saus'

export function purgeCloudflare(zoneId: string): PurgePlugin {
  return {
    name: '@saus/cloudflare-cache:purge',
    async purge(request) {
      if (request.globs.has('/*')) {
        const request = createRequestFn({
          apiToken: secrets.apiToken,
          logger: { info: console.log },
        })
        await request('post', `/zones/${zoneId}/purge_cache`, {
          body: { json: { purge_everything: true } },
        })
      } else {
        // TODO: path-specific purging
      }
    },
  }
}
