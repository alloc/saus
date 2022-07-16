import { createStore } from '@saus/aws-s3'
import { PageStoreConfig as Config, setupPageStore as setup } from '@saus/page-store'

export type PageStoreConfig = Omit<Config, 'store'> & {
  bucket: string
  region: string
}

export function setupPageStore(config: PageStoreConfig) {
  setup({
    store: createStore(config.bucket, config.region),
    ...config,
  })
}
