import { createRequestFn, secrets } from '@saus/cloudflare-request'
import { defineDeployHook } from 'saus/deploy'
import { diffObjects } from 'saus/utils/diffObjects'
import { pick } from 'saus/utils/pick'
import { DnsRecord, DnsRecordList } from './types'
import { toTable } from './utils'

export interface DnsRecordsTarget {
  zoneId: string
  records: DnsRecordList
}

export default defineDeployHook(async ctx => {
  const request = createRequestFn({
    apiToken: secrets.apiToken,
    logger: ctx.logger,
  })

  function getRecordKey(rec: DnsRecord) {
    return [rec.type, rec.name].join('+')
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
          return ctx.logPlan(
            `update "${rec.type} ${rec.name}" record in zone ${zoneId}`,
            () => putRecord(zoneId, oldRecord.id, rec)
          )
        }
      } else {
        return ctx.logPlan(
          `create "${rec.type} ${rec.name}" record in zone ${zoneId}`,
          () =>
            createRecord(zoneId, rec).then(resp => {
              newRecordIds.set(rec, resp.id)
            })
        )
      }
    })

    // Detect which records were removed.
    const deletions = Object.values(oldRecords).map(oldRec => {
      if (!reusedRecords.has(oldRec)) {
        return ctx.logPlan(
          `delete "${oldRec.type} ${oldRec.name}" record in zone ${zoneId}`,
          () => deleteRecord(zoneId, oldRec.id)
        )
      }
    })

    // TODO: rollback successful updates if one fails
    await Promise.all([...updates, ...deletions])

    return async () => {
      const undoUpdates = records.map(rec => {
        const key = getRecordKey(rec)
        const oldRecord = oldRecords[key]
        if (!oldRecord) {
          const id = newRecordIds.get(rec)!
          return deleteRecord(zoneId, id)
        }
        if (changedRecords.has(oldRecord)) {
          return putRecord(
            zoneId,
            oldRecord.id,
            pick(oldRecord, DnsRecordConfigKeys)
          )
        }
      })

      const undoDeletions = Object.values(oldRecords).map(oldRecord => {
        if (!reusedRecords.has(oldRecord)) {
          return createRecord(zoneId, pick(oldRecord, DnsRecordConfigKeys))
        }
      })

      // TODO: catch permission errors
      await Promise.all([...undoUpdates, ...undoDeletions])
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
      await ctx.logPlan(`delete all records in zone ${zoneId}`, () =>
        Promise.all(
          Object.values(oldRecords).map(oldRecord =>
            deleteRecord(zoneId, oldRecord.id)
          )
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
