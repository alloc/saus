// This overrides the "saus/core" entry in SSR bundles.
import { setRenderModule, setRoutesModule } from '@/global'
import { context } from '../bundle/context'
import { addRenderers } from '../bundle/render'

export * from '@/api'
export * from '@/node/esmInterop'
export * from '@/runtime/ssrModules'
// Isolated renderers need this exposed in SSR bundles.
export { addRenderers }

// In SSR bundles, these globals are mutated at the top level
// immediately, so they need to be defined now.
setRoutesModule(context)
setRenderModule(context)

// This is also exported by "saus/src/core/client" but we
// want to avoid processing that module, since it has heavy
// dependencies that bog down Rollup.
export const defineClient = (x: any) => x
