import { defineDeployHook, diffObjects, pick } from 'saus/core'
import { createRequestFn } from './api/request'
import { DnsRecord, DnsRecordList } from './types'
import { toTable } from './utils'

export interface DnsRecordsTarget {
  zoneId: string
  records: DnsRecordList
}

export default defineDeployHook(async ctx => {
  const [apiToken] = await ctx.secrets.expect(['CLOUDFLARE_API_TOKEN'])
  const request = createRequestFn({
    apiToken,
    logger: ctx.logger,
  })

  function getRecordKey(rec: DnsRecord) {
    return [rec.type, rec.name, rec.content].join('+')
  }

  async function listRecords(zoneId: string) {
    type Props = { id: string }
    return request<DnsRecordList<Props>>('get', `/zones/${zoneId}/dns_records`)
  }

  async function createRecord(zoneId: string, rec: DnsRecord) {
    type Response = { id: string }
    return request<Response>('post', `/zones/${zoneId}/dns_records`, {
      body: { json: rec },
    })
  }

  async function putRecord(zoneId: string, recId: string, rec: DnsRecord) {
    return request('put', `/zones/${zoneId}/dns_records/${recId}`, {
      body: { json: rec },
    })
  }

  async function deleteRecord(zoneId: string, recId: string) {
    return request('delete', `/zones/${zoneId}/dns_records/${recId}`)
  }

  async function putRecords({ zoneId, records }: DnsRecordsTarget) {
    const oldRecords = toTable(await listRecords(zoneId), getRecordKey)
    const reusedRecords = new Set<DnsRecord>()
    const changedRecords = new Set<DnsRecord>()
    const newRecordIds = new Map<DnsRecord, string>()

    // Detect which records are new and which have changed.
    const updates = records.map(rec => {
      const key = getRecordKey(rec)
      const oldRecord = oldRecords[key]
      if (oldRecord) {
        reusedRecords.add(oldRecord)
        if (diffObjects(pick(oldRecord, DnsRecordConfigKeys), rec)) {
          changedRecords.add(oldRecord)
          return putRecord(zoneId, oldRecord.id, rec)
        }
      } else {
        return createRecord(zoneId, rec).then(resp => {
          newRecordIds.set(rec, resp.id)
        })
      }
    })

    // Detect which records were removed.
    const deletions = Object.values(oldRecords).map(
      oldRec => reusedRecords.has(oldRec) || deleteRecord(zoneId, oldRec.id)
    )

    // TODO: rollback successful updates if one fails
    await Promise.all([...updates, ...deletions])

    return async () => {
      const updates = Object.values(oldRecords).map(oldRec => {
        if (changedRecords.has(oldRec)) {
          return request('put', `/zones/${zoneId}`)
        }
      })

      const deletions = records.map(rec => {
        const key = getRecordKey(rec)
        const oldRecord = oldRecords[key]
        if (oldRecord) {
          if (changedRecords.has(oldRecord)) {
            return putRecord(
              zoneId,
              oldRecord.id,
              pick(oldRecord, DnsRecordConfigKeys)
            )
          }
          if (!reusedRecords.has(oldRecord)) {
            return createRecord(zoneId, pick(oldRecord, DnsRecordConfigKeys))
          }
        } else {
          const id = newRecordIds.get(rec)!
          return deleteRecord(zoneId, id)
        }
      })

      // TODO: catch permission errors
      await Promise.all([...updates, ...deletions])
    }
  }

  return {
    name: 'cloudflare-dns',
    async pull(target: DnsRecordsTarget) {
      const declaredRecords = toTable(target.records, getRecordKey)
      return {
        records: Object.values(declaredRecords),
      }
    },
    identify: target => ({ zoneId: target.zoneId }),
    spawn: putRecords,
    update: putRecords,
    async kill({ zoneId }) {
      const oldRecords = await listRecords(zoneId)
      await Promise.all(
        Object.values(oldRecords).map(oldRecord =>
          deleteRecord(zoneId, oldRecord.id)
        )
      )
      return async () => {
        await Promise.all(
          Object.values(oldRecords).map(oldRecord =>
            createRecord(zoneId, pick(oldRecord, DnsRecordConfigKeys))
          )
        )
      }
    },
  }
})

// These properties are configurable.
const DnsRecordConfigKeys = [
  'type',
  'name',
  'content',
  'ttl',
  'proxied',
  'priority',
] as const
