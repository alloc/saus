import { Promisable } from 'type-fest'
import { UserConfig, vite } from './core'

export * from './bundle/runtime/api'
export type { OutputBundle } from './bundle/types'
export { loadBundle, Plugin, setEnvData, UserConfig, vite } from './core'

export const build = importWhenCalled('build', () => import('./build/api.js')),
  deploy = importWhenCalled('deploy', () => import('./deploy/api.js')),
  generateBundle = importWhenCalled('bundle', () => import('./bundle/api.js')),
  createServer = importWhenCalled('createServer', () => import('./dev/api.js'))

// The type-casting below ensures the "saus" config is type-checked.
export const defineConfig = vite.defineConfig as (
  config: UserConfig | ((env: vite.ConfigEnv) => Promisable<UserConfig>)
) => vite.UserConfigExport

function importWhenCalled<T, P extends string, Module extends { [K in P]: T }>(
  name: P,
  importFn: () => Promise<Module>
): P extends keyof Module ? Function & Module[P] : never {
  let exports: any
  const wrapper = async (...args: any[]) => {
    const { [name]: fn } = await (exports ||= importFn())
    return fn(...args)
  }
  return wrapper as any
}
