// Redirect "saus/core" imports here.

export * from '../../core/api'

// This is also exported by "saus/src/core/client" but we
// want to avoid processing that module, since it has heavy
// dependencies that bog down Rollup.
export const defineClient = (x: any) => x

// Ignore config hooks in SSR bundle.
export const addConfigHook = () => {}

// These are needed for isolated routes.
export * from '../ssrModules'
export * from '../render'
export * from '../../utils/esmInterop'
