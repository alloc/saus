import { addSecrets } from 'saus/deploy'
import { http } from 'saus/http'
import secrets from './secrets'

addSecrets(purgeAllFiles, secrets)

/**
 * Purge the Cloudflare cache of all files.
 *
 * Call this within an `onDeploy` callback, and make sure
 * to check `ctx.dryRun` before doing so.
 */
export function purgeAllFiles(zoneId: string) {
  return http.post(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
    {
      body: { json: { purge_everything: true } },
      headers: {
        'X-Auth-Email': secrets.email,
        'X-Auth-Key': secrets.apiKey,
      },
    }
  )
}
