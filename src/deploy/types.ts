import { Changed } from '@utils/types'
import { Merge, Promisable } from 'type-fest'
import { DeployContext } from './context'

export type DeployAction<T = any> =
  | DeployActionFn<T>
  | {
      name: string
      run: DeployActionFn<T>
    }

export type DeployActionFn<T = any> = (
  context: DeployContext & { command: 'deploy' },
  onRevert: (revertFn: RevertFn) => void
) => Promisable<T>

export type DeployFile = {
  version: number
  targets: {
    plugin: string
    state: DeployTarget
  }[]
  plugins: {
    [name: string]: string
  }
}

export interface DeployHookRef<
  State extends object = any,
  PulledState extends object = any
> {
  load: () => Promise<DeployHookModule<State, PulledState>>
  hook?: DeployHook<State, PulledState>
  plugin?: DeployPlugin<State, PulledState>
}

export type DeployHookModule<
  State extends object = any,
  PulledState extends object = any
> = {
  default: DeployHook<State, PulledState>
}

export type DefineDeployHook = {
  <Props extends object, State extends object>(
    hook: SmartDeployHook<Props, State>
  ): typeof hook
  <Props extends object>(hook: DumbDeployHook<Props>): typeof hook
}

export type DeployHook<
  Props extends object = any,
  State extends object = any
> = (SmartDeployHook<Props, State> | DumbDeployHook<Props>) & {
  /** Where the hook was loaded from */
  file?: string
}

/**
 * This deploy hook defines a `pull` method for synchronizing
 * each target's metadata with an external source.
 *
 * Note that synchronized targets are not necessarily safe
 * to reconfigure from anywhere else. It's the hook's responsibility
 * to guarantee safety in that regard.
 */
export type SmartDeployHook<
  Props extends object = any,
  State extends object = any
> = (context: DeployContext) => Promisable<
  {
    pull: (props: Props) => Promise<State>
  } & Pick<DeployPlugin.Base<Props, State>, keyof DeployPlugin.Base> &
    Omit<DeployPlugin.Addons<Props, State>, 'pull'>
>

/**
 * Only "dumb" in that it has no `pull` method, which means
 * the target metadata does not synchronize with an external source.
 *
 * Avoid reconfiguring the deployed targets from anywhere else (eg:
 * the service's web UI), as this hook won't notice those changes.
 */
export type DumbDeployHook<Props extends object = any> = (
  context: DeployContext
) => Promisable<
  {
    identify: (props: Props) => Promisable<Record<string, any>>
    pull?: undefined
  } & Omit<DeployPlugin.Base<Props, {}>, 'identify'> &
    Omit<DeployPlugin.Addons<Props, {}>, 'pull'>
>

export interface DeployPlugin<
  Props extends object = any,
  State extends object = any
> extends DeployPlugin.Base<Props, State>,
    DeployPlugin.Addons<Props, State> {}

export namespace DeployPlugin {
  export interface Base<
    Props extends object = any,
    State extends object = any
  > {
    /**
     * A globally unique namespace that deployed target
     * metadata is stored within.
     */
    name: string
    /**
     * Specify which target state shouldn't be cached.
     */
    ephemeral?: (keyof Merge<Props, State>)[]
    /**
     * Return data that identifies the target. \
     * Exclude data that only configures behavior.
     */
    identify: (target: Merge<Props, State>) => Promisable<Record<string, any>>
    /**
     * Deploy the given target.
     */
    spawn: (
      this: DeployPlugin<Props, State>,
      target: DeployTarget<Props, State>,
      onRevert: (fn: RevertFn) => void
    ) => Promisable<RevertFn | void>
    /**
     * Destroy the given target.
     */
    kill: (
      this: DeployPlugin<Props, State>,
      target: DeployTarget<Props, State>,
      onRevert: (fn: RevertFn) => void
    ) => Promisable<RevertFn | void>
  }
  export interface Addons<
    Props extends object = any,
    State extends object = any
  > {
    /**
     * Some targets may need to pull state from an external source
     * of truth before they can be identified.
     */
    pull?: (props: Props) => Promisable<State>
    /**
     * Update the configuration of the given target. \
     * If undefined, a changed target will be killed and respawned.
     */
    update?: (
      this: DeployPlugin<Props, State>,
      target: DeployTarget<Props, State>,
      changed: Changed<Props & State>,
      onRevert: (fn: RevertFn) => void
    ) => Promisable<RevertFn | void>
  }
}

export type RevertFn = () => Promisable<void>

/**
 * Deploy targets are plugin-specific data records that track which
 * cloud infrastructure should be spawned or killed.
 */
export type DeployTarget<
  Props extends object = Record<string, any>,
  State extends object = {}
> = Merge<Props, State> & {
  _id?: DeployTargetId
}

export type DeployTargetId = {
  hash: string
  values: Record<string, any>
}

export type DeployTargetArgs = [
  hook: DeployHookRef,
  target: Promisable<DeployTarget>,
  resolve: (outputs: any) => void
]
