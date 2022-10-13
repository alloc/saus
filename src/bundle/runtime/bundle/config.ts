import type { RuntimeConfig } from '@runtime/config'

/**
 * Configures the runtime behavior of the SSR bundle.
 *
 * Can be extended by Saus plugins.
 */
const config: RuntimeConfig = (globalThis as any).sausRuntimeConfig

// Stub module replaced at build time
export default config
