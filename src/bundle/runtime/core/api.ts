// This overrides the "saus/core" entry in SSR bundles.
import { setRoutesModule } from '@runtime/global'
import { context } from '../bundle/context'

export * from '@/api'
export * from '@/vm/esmInterop'
export * from '@runtime/ssrModules'

// In SSR bundles, these globals are mutated at the top level
// immediately, so they need to be defined now.
setRoutesModule(context)

// This is also exported by "saus/src/core/client" but we
// want to avoid processing that module, since it has heavy
// dependencies that bog down Rollup.
export const defineClient = (x: any) => x
