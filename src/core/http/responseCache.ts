import fs from 'fs'
import { dirname, resolve } from 'path'
import { unwrapBuffer } from '../buffer'
import type { CacheEntry } from '../runtime/withCache'
import { md5Hex } from '../utils/md5-hex'
import { readJson } from '../utils/readJson'
import { Response } from './response'

export interface ResponseCache extends ReturnType<typeof loadResponseCache> {}

export let responseCache: ResponseCache | null = null

export const setResponseCache = (cache: ResponseCache | null) =>
  (responseCache = cache)

export function loadResponseCache(root: string) {
  const cacheDir = resolve(root, 'node_modules/.saus/http-cache')
  const metadataFile = resolve(cacheDir, 'metadata.json')
  let metadata: Record<string, CacheEntry<string>>
  try {
    metadata = readJson(metadataFile)
  } catch {
    metadata = {}
  }

  return {
    read(cacheKey: string) {
      const entry = metadata[cacheKey]
      if (!entry) {
        return null
      }
      const [fileName, expiresAt = 0] = entry
      try {
        var data = fs.readFileSync(resolve(cacheDir, fileName))
      } catch {
        return null
      }
      return {
        expired: expiresAt < Date.now(),
        get object() {
          return decodeResponse(data)
        },
      }
    },
    write(cacheKey: string, resp: Response, maxAge: number) {
      const entry = metadata[cacheKey]
      const fileName = entry?.[0] || md5Hex(cacheKey).slice(0, 8)
      const filePath = resolve(cacheDir, fileName)

      fs.mkdirSync(dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, encodeResponse(resp))

      metadata[cacheKey] = [fileName, Date.now() + maxAge * 1e3]
      fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2))
    },
  }
}

const delimiter = /* @__PURE__ */ Buffer.from('\r\n')

function encodeResponse(resp: Response) {
  return Buffer.concat([
    Buffer.from(JSON.stringify(resp.headers)),
    delimiter,
    unwrapBuffer(resp.data),
  ])
}

function decodeResponse(data: Buffer) {
  const indices: number[] = []
  for (let i = 0; i < data.length && indices.length < 2; ) {
    if (isDelimiter(data, i)) {
      indices.push(i, (i += delimiter.length))
    } else {
      i += 1
    }
  }
  const headers = JSON.parse(data.slice(0, indices[0]).toString('utf8'))
  return new Response(data.slice(indices[1]), 200, headers)
}

function isDelimiter(data: Buffer, offset: number) {
  return !Buffer.compare(
    data.slice(offset, offset + delimiter.length),
    delimiter
  )
}
