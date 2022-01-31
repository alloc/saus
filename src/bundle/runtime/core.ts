// Redirect "saus/core" imports here.
import type { RuntimeHook } from '../../core'
import { context } from './context'

// This replaces the `setup` function exported from "saus/src/core/setup"
export function setup(hook: RuntimeHook) {
  context.runtimeHooks.push(hook)
}

// This is also exported by "saus/src/core/client" but we
// want to avoid processing that module, since it has heavy
// dependencies that bog down Rollup.
export const defineClient = (x: any) => x

// Ignore config hooks in SSR bundle.
export const addConfigHook = () => {}

export * from '../../core/api'
export const Buffer = globalThis.Buffer
