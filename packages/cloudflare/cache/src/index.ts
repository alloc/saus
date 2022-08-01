import { createRequestFn, secrets } from '@saus/cloudflare-request'
import { PurgePlugin } from 'saus'
import { addSecrets, getDeployContext } from 'saus/deploy'

addSecrets(purgeAllFiles, secrets)

/**
 * Purge the Cloudflare cache of all files.
 *
 * Call this within an `onDeploy` callback, and make sure
 * to check `ctx.dryRun` before doing so.
 */
export function purgeAllFiles(zoneId: string) {
  const ctx = getDeployContext()
  const request = createRequestFn({
    apiToken: secrets.apiToken,
    logger: ctx.logger,
  })
  return request('post', `/zones/${zoneId}/purge_cache`, {
    body: { json: { purge_everything: true } },
  })
}

export function purgeCloudflare(zoneId: string): PurgePlugin {
  return {
    name: '@saus/cloudflare-cache:purge',
    purge(request) {
      if (request.globs.has('/*')) {
        return purgeAllFiles(zoneId)
      }
      // TODO: path-specific purging
    },
  }
}
