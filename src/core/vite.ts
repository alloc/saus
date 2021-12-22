import * as vite from 'vite'
import { ClientDescription } from './client'
import { SausContext } from './context'

export { vite }

export interface SausOptions {
  /**
   * Renderer packages need to add their `defineClient` object
   * to this array, so the SSR bundler can prepare build artifacts
   * used by the SSR bundle to generate client modules.
   */
  clients?: ClientDescription[]
  /**
   * The `ClientModule` objects produced by the SSR bundle all have
   * a `file` property. This option defines their root directory.
   *
   * @default ".cache"
   */
  cacheDir?: string | null
}

declare module 'vite' {
  interface UserConfig {
    saus?: SausOptions
  }
}

export interface UserConfig extends vite.UserConfig {
  filterStack?: (source: string) => boolean
}

export interface BuildOptions extends vite.BuildOptions {
  maxWorkers?: number
  force?: boolean
}

export const defineConfig = (
  config:
    | UserConfig
    | Promise<UserConfig>
    | ((env: vite.ConfigEnv) => UserConfig | Promise<UserConfig>)
) => vite.defineConfig(config)

export interface Plugin extends vite.Plugin {
  /** Called when routes and/or render hooks are updated */
  contextUpdate?: (context: SausContext) => void
}

export type SourceDescription = Extract<
  Exclude<ReturnType<Exclude<vite.Plugin['load'], void>>, Promise<any>>,
  object
>
