// This module provides Node.js compatibility for when "saus/client"
// is imported by the routes module in development.
export * from '../runtime/stateModules'
export * from '../runtime/ttl'
export * from '../core/http'
export * from '../core/buffer'
export * from '../utils/getPagePath'
export * from '../utils/resolveModules'
export * from '../utils/unwrapDefault'

export const loadPageModule = clientOnly('loadPageModule')
export const loadClientState = clientOnly('loadClientState')

function clientOnly(name: string) {
  return () => {
    throw Object.assign(
      Error(
        `Calling "${name}" in SSR is forbidden. ` +
          `Ensure \`import.meta.env.SSR\` is false before calling it.`
      ),
      { framesToPop: 1 }
    )
  }
}
