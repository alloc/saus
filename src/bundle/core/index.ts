// Redirect "saus/core" imports here.
import { setRenderModule, setRoutesModule } from '../../core/global'
import { context } from '../context'

export * from '../../core/api'

// In SSR bundles, these globals are mutated at the top level
// immediately, so they need to be defined now.
setRoutesModule(context)
setRenderModule(context)

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
