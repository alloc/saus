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
  ): Promise<void>
  /**
   * Remove an asset by its name.
   */
  delete(name: string): Promise<void>
}
