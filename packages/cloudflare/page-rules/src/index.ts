import { addDeployHook, addDeployTarget, addSecrets } from 'saus/deploy'
import secrets from './secrets'
import { DnsRecordList } from './types'

const hook = addDeployHook(() => import('./hook'))
addSecrets(useCloudflareDNS, secrets)

export function useCloudflareDNS(zoneId: string, records: DnsRecordList) {
  for (const rec of records) {
    rec.ttl ??= 1
  }
  return addDeployTarget(hook, {
    zoneId,
    records,
  })
}
