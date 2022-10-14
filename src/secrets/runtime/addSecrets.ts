import { DefinedSecrets } from '@/runtime/secrets/types'
import { getDeployContext } from '../../deploy/context'

/**
 * Associate the given `fn` with a `defineSecrets` result,
 * so its secrets are loaded when `fn` is imported in
 * the deploy file.
 */
export function addSecrets(fn: Function, expected: DefinedSecrets): void

/**
 * For any `deps` that had secrets attached with `addSecrets`,
 * their secrets will be loaded when the `fn` has its own secrets
 * loaded.
 */
export function addSecrets(fn: Function, deps: Function[]): void

/* @internal */
export function addSecrets(
  fn: Function,
  namesOrDeps: DefinedSecrets | Function[]
) {
  const ctx = getDeployContext()
  if (ctx) {
    if (Array.isArray(namesOrDeps)) {
      ctx.secrets['_adopted'].set(fn, namesOrDeps)
    } else {
      ctx.secrets['_defined'].set(fn, namesOrDeps)
    }
  }
}
