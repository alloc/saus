import { BufferLike, RenderedFile } from '@runtime/app'
import { Http, normalizeHeaders } from '@runtime/http'
import QuickLRU, { Options } from 'quick-lru'

type BoundHeadersFn = () => Http.Headers | null | undefined
type HeadersParam =
  | Http.Headers
  | null
  | ((url: string) => Http.Headers | null | undefined)

export interface FileCache extends QuickLRU<string, FileCacheEntry> {
  addFile(id: string, content: BufferLike, headers?: Http.Headers | null): void
  addFiles(files: RenderedFile[], headers?: HeadersParam): void
}

export type FileCacheOptions = Options<string, FileCacheEntry>

export type FileCacheEntry = [
  data: string | Buffer | Http.Redirect,
  headers: BoundHeadersFn | null | undefined
]

export function createFileCache(base: string, options?: FileCacheOptions) {
  const cache = new QuickLRU({ maxSize: 200, ...options }) as FileCache

  cache.addFile = (id, content, headers) => {
    const url = base + id
    if (!cache.has(url)) {
      headers = resolveHeaders(headers, url)
      cache.set(url, [
        // This type cast is 100% safe, since the BufferLike type is
        // guaranteed to be a string or Node buffer on the server.
        content as string | Buffer,
        () => headers,
      ])
    }
  }

  cache.addFiles = (files, headers) =>
    files.forEach(file => {
      const url = base + file.id
      if (!cache.has(url)) {
        cache.set(url, [
          // This type cast is 100% safe, since the BufferLike type is
          // guaranteed to be a string or Node buffer on the server.
          file.data as string | Buffer,
          resolveHeaders.bind(null, headers, url, file.mime),
        ])
      }
    })

  return cache
}

function resolveHeaders(
  headers: HeadersParam | undefined,
  url: string,
  mime?: string
): Http.Headers | null | undefined {
  if (typeof headers == 'function') {
    headers = headers(url)
  }
  headers = normalizeHeaders(headers) || {}
  if (mime) {
    headers['content-type'] = mime
  }
  return headers
}
