import path from 'path'
import { Changed, Promisable } from '../utils/types'
import { injectNodeModule } from '../vm/nodeModules'
import { BundleContext } from './bundle'
import { GitFiles } from './deploy/files'
import { SecretHub } from './deploy/secrets'
import { deployModule } from './global'

const contextPath = path.resolve(__dirname, '../core/context.cjs')

export function getDeployContext() {
  return (void 0, require)(contextPath) as DeployContext
}

export function injectDeployContext(context: DeployContext) {
  injectNodeModule(contextPath, context)
}

export interface DeployContext extends BundleContext {
  files: GitFiles
  secretHub: SecretHub
  secrets: Record<string, any>
  /** For git operations, deploy to this repository. */
  gitRepo: { name: string; url: string }
  /** When true, skip any real deployment. */
  dryRun: boolean
}

export function addDeployTarget<T extends object>(
  hook: DeployHook<T>,
  target: T & DeployTarget
): void {
  let targets = deployModule.deployHooks.get(hook)
  if (!targets) {
    targets = []
    deployModule.deployHooks.set(hook, targets)
  }
  targets.push(target)
}

export type DeployHooks = Map<DeployHook, DeployTarget[]>

export interface DeployModule {
  deployHooks: DeployHooks
}

export type DeployHook<T extends object = any> = (
  context: DeployContext
) => Promisable<DeployPlugin<T>>

export interface DeployPlugin<T extends object = any> {
  /**
   * A globally unique namespace that deployed target
   * metadata is stored within.
   */
  name: string
  /**
   * Return data that identifies the target. \
   * Exclude data that only configures behavior.
   */
  identify(this: DeployPlugin<T>, target: T): Promisable<Record<string, any>>
  /**
   * Prepare the given target for deployment.
   */
  build?(
    this: DeployPlugin<T>,
    target: T,
    changed?: Changed<T>
  ): Promisable<void>
  /**
   * Deploy the given target.
   */
  spawn(this: DeployPlugin<T>, target: T): Promisable<RevertFn | void>
  /**
   * Update the configuration of the given target. \
   * If undefined, a changed target will be killed and respawned.
   */
  update?(
    this: DeployPlugin<T>,
    target: T,
    changed: Changed<T>
  ): Promisable<RevertFn | void>
  /**
   * Destroy the given target.
   */
  kill(this: DeployPlugin<T>, target: T): Promisable<RevertFn | void>
  /**
   * Called after all targets are spawned, updated, or killed.
   */
  finalize?(this: DeployPlugin<T>): Promisable<RevertFn | void>
}

export type RevertFn = () => Promisable<void>

/**
 * Deploy targets are plugin-specific data records that track which
 * cloud infrastructure should be spawned or killed.
 */
export interface DeployTarget {
  _id?: string
}
