import { defineDeployHook, pick } from 'saus/core'
import { createRequestFn } from './api/request'
import { DnsRecord, DnsRecordList } from './types'
import { toTable } from './utils'

export interface DnsRecordsTarget {
  zoneId: string
  records: DnsRecordList
}

export default defineDeployHook(async ctx => {
  const [apiToken] = await ctx.secrets.expect(['CLOUDFLARE_API_TOKEN'])
  const request = createRequestFn({ apiToken, logger: ctx.logger })

  function getRecordId(rec: DnsRecord) {
    return [rec.type, rec.name, rec.content].join('+')
  }
  async function listRecords(zoneId: string) {
    type Props = { id: string }
    return request<DnsRecordList<Props>>('get', `/zones/${zoneId}/dns_records`)
  }
  async function updateRecords(target: DnsRecordsTarget) {
    const oldRecords = toTable(await listRecords(target.zoneId), getRecordId)
    const updatedRecords = new Set<DnsRecord>()
    const updates = target.records.map(rec => {
      const id = getRecordId(rec)
      const oldRecord = oldRecords[id]
      if (oldRecord) {
        updatedRecords.add(oldRecord)
        return request(
          'put',
          `/zones/${target.zoneId}/dns_records/${oldRecord.id}`,
          { body: { json: rec } }
        )
      }
      return request('post', `/zones/${target.zoneId}/dns_records`, {
        body: { json: rec },
      })
    })
    await Promise.all(
      updates.concat(
        Object.values(oldRecords).map(
          oldRec => updatedRecords.has(oldRec) || request('delete')
        )
      )
    )
  }

  return {
    name: 'cloudflare-dns',
    async pull(target: DnsRecordsTarget) {
      const declaredRecords = toTable(target.records, getRecordId)
      return {
        records: Object.values(declaredRecords),
      }
    },
    identify: target => ({ zoneId: target.zoneId }),
    spawn: updateRecords,
    update: updateRecords,
    async kill(target) {
      const oldRecords = await listRecords(target.zoneId)
      await Promise.all(
        Object.values(oldRecords).map(({ id }) =>
          request('delete', `/zones/${target.zoneId}/dns_records/${id}`)
        )
      )
      return async () => {
        await Promise.all(
          Object.values(oldRecords).map(rec =>
            request('post', `/zones/${target.zoneId}/dns_records`, {
              body: {
                json: pick(rec, [
                  'type',
                  'name',
                  'content',
                  'ttl',
                  'proxied',
                  'priority',
                ]),
              },
            })
          )
        )
      }
    },
  }
})
