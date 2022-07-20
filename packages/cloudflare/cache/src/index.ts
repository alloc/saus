import { createRequestFn, secrets } from '@saus/cloudflare-request'
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
