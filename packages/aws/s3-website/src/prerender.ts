import { SausContext } from 'saus/core'
import { getDeployContext } from 'saus/deploy'

export function preRenderPages(opts: {
  filter?: string[] | ((pagePath: string) => boolean)
  context?: SausContext
}) {
  const ctx = opts.context || getDeployContext()
  if (!ctx) {
    throw Error('Saus context is missing')
  }
}
