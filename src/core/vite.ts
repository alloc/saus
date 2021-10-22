import * as vite from 'vite'
import { SausContext } from './context'

export { vite }

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
