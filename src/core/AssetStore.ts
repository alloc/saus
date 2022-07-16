import { Promisable } from 'type-fest'
import { ResponseHeaders } from './http'

/**
 * The `AssetStore` is a normalized object storage layer.
 */
export interface AssetStore {
  supportedHeaders?: string[]
  /**
   * Upsert an asset by its name.
   */
  put(
    name: string,
    data: string | Buffer,
    headers?: ResponseHeaders
  ): Promisable<void>
  /**
   * Remove an asset by its name.
   */
  delete(name: string): Promisable<void>
}
