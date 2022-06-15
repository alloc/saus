import callerPath from 'caller-path'
import { Promisable } from 'type-fest'
import { defer } from '../utils/defer'
import { DeployContext, getDeployContext } from './deploy/context'
import type {
  DefineDeployHook,
  DeployHookModule,
  DeployHookRef,
} from './deploy/types'

/**
 * This enables static typing for deploy hook declarations.
 *
 * When a deploy hook has no `pull` method, its `Props` type must be
 * defined through the callsite (as seen below). The "props" are user-defined
 * metadata given to the hook for deployment purposes.
 *
 *     defineDeployHook<Props>(...)
 *
 * When the `pull` method is defined, you must have an explicit parameter
 * type, but the return type will be inferred. In this example, the `pulled`
 * property is automatically exposed on the other methods' `target` object.
 *
 *     async pull(target: Target) {
 *       return { pulled: true }
 *     }
 */
export const defineDeployHook: DefineDeployHook = (hook: any) => {
  hook.file = callerPath()
  return hook
}

export function addDeployHook<State extends object, PulledState extends object>(
  load: () => Promise<DeployHookModule<State, PulledState>>
): DeployHookRef<State, PulledState> {
  const { deployHooks } = getDeployContext()
  const hookRef: DeployHookRef = { load }
  deployHooks.push(hookRef)
  return hookRef
}

export function addDeployTarget<
  State extends object,
  PulledState extends object
>(
  hook: DeployHookRef<State, PulledState>,
  state: Promisable<Omit<State, keyof PulledState> & Partial<PulledState>>
): Promise<State> {
  const { promise, resolve } = defer<State>()
  const { addTarget } = getDeployContext()
  addTarget(hook, state, resolve)
  return promise
}

export * from './deploy/files'
export * from './deploy/secrets'
export * from './deploy/types'
export { DeployContext, getDeployContext }
