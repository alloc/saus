import type { RuntimeConfig } from './config'

// This allows internal Saus modules to access the runtime config
// when they are embedded in an SSR bundle.
const runtimeConfig: Partial<RuntimeConfig> = {}
export default runtimeConfig
