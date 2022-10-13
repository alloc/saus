import { defer } from '@utils/defer'
import { getStackFrame } from '@utils/node/stack'
import { Merge, Promisable } from 'type-fest'
import { getDeployContext } from './context'
import type {
  DefineDeployHook,
  DeployAction,
  DeployHookModule,
  DeployHookRef,
} from './types'

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
  const frame = getStackFrame(1)
  if (!frame) {
    throw Error('Failed to infer source file')
  }
  hook.file = frame.file
  return hook
}

export function addDeployHook<State extends object, PulledState extends object>(
  load: () => Promise<DeployHookModule<State, PulledState>>
): DeployHookRef<State, PulledState> {
  const ctx = getDeployContext()
  const hookRef: DeployHookRef = { load }
  ctx?.deployHooks.push(hookRef)
  return hookRef
}

export function addDeployTarget<
  State extends object,
  PulledState extends object
>(
  hook: DeployHookRef<State, PulledState>,
  state: Promisable<State & Omit<Partial<PulledState>, keyof State>>
): Promise<Merge<State, PulledState>> {
  const ctx = getDeployContext()
  const { promise, resolve } = defer<any>()
  ctx.addDeployTarget(hook, state, resolve)
  return promise
}

/**
 * Deploy actions only run when `saus deploy` is used.
 * They should return a rollback function in case deployment
 * fails after this action is completed.
 */
export function onDeploy<T = any>(action: DeployAction<T>) {
  const ctx = getDeployContext()
  return ctx.addDeployAction(action)
}
