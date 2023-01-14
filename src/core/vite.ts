import { App, RenderedPage } from '@runtime/app/types'
import type { RuntimeConfig } from '@runtime/config'
import type { Endpoint } from '@runtime/endpoint'
import type { AbortSignal } from '@utils/AbortController'
import { Merge } from 'type-fest'
import * as vite from 'vite'
import type { BundleOptions, OutputBundle, PageBundle } from '../bundle/types'
import type { SausContext } from './context'
import { ModuleInjection } from './injectModules'
import type { PublicDirOptions, PublicFile } from './publicDir'
import type { TestPlugin } from './testPlugin'
import './vite/requireHook'

export { vite }

export type Plugin = vite.Plugin

export type ResolvedConfig = Omit<vite.ResolvedConfig, 'saus'> & {
  readonly saus: Readonly<SausConfig>
  plugins: vite.Plugin[]
}

export const BundleConfigDefaults = {
  type: 'script',
  format: 'cjs',
  target: 'node14',
  clientStore: 'inline',
} as const

export type DefaultBundleConfig = Pick<
  Required<UserBundleConfig>,
  keyof typeof BundleConfigDefaults
>

export interface BundleConfig
  extends Merge<UserBundleConfig, DefaultBundleConfig> {
  entry: string | null
  outFile?: string
}

export interface UserBundleConfig {
  /**
   * Path to the module bundled by the `saus bundle` command.
   * It should import `saus/bundle` (and optionally `saus/paths`)
   * to render pages on-demand and/or ahead-of-time.
   * @default null
   */
  entry?: string | null
  /**
   * For serverless functions, you'll want to set this to `"worker"`.
   * @default "script"
   */
  type?: 'script' | 'worker'
  /**
   * Set `build.target` for the SSR bundle.
   * @default "node14"
   */
  target?: string
  /**
   * The module format of the generated SSR bundle.
   * @default "cjs"
   */
  format?: 'esm' | 'cjs'
  /**
   * Expose a debug version of your site, with sourcemaps and unminified
   * production files.
   */
  debugBase?: string
  /**
   * Minify the SSR bundle.
   * @default false
   */
  minify?: boolean
  /**
   * Force certain imports to be isolated such that every page rendered
   * will use a separate instance of the resolved module. This option is
   * useful when a dependency has global state, but you still want to
   * use parallel rendering. Your project's local modules are isolated
   * by default.
   */
  isolate?: (string | RegExp)[]
  /**
   * Prevent certain imports from being isolated, so their module instance
   * is reused between page requests.
   */
  noIsolate?: (string | RegExp)[]
  /**
   * Control how the client modules are stored and served.
   *
   * - `"inline"` (the default) \
   *   Client modules are inlined into the bundle. Binary assets are
   *   encoded with Base64. This option increases the bundle size considerably.
   *
   * - `"external"` \
   *   Client modules are **not served** by the bundle. You should use a
   *   deploy plugin that uploads them to an object storage service like
   *   Amazon S3.
   *
   * - `"local"` \
   *   Client modules are written to their own files in `build.outDir` and
   *   loaded with `fs.readFileSync` on-demand.
   */
  clientStore?: 'inline' | 'external' | 'local'
  /**
   * Define which modules should never be bundled.
   */
  external?: string[]
  /**
   * Define which source files should trigger a rebundle when changes to
   * them are committed to Git history. The paths can be directories and
   * they're assumed relative to the project root.
   *
   * By default, all files in the repository can trigger a rebundle.
   * If this option is defined, lockfiles are included automatically.
   */
  sources?: string[]
}

export interface SausConfig {
  /**
   * This module is imported automatically by the Saus runtime,
   * in both development and production builds.
   *
   * It only runs on the server, and its job is to provide routes,
   * state modules, and a place for dependency injection.
   *
   * @default "src/node/routes.ts"
   */
  routes: string
  /**
   * Path to the module that provides the default layout.
   * @default "/src/layouts/default"
   */
  defaultLayoutId?: string
  /**
   * Configure the `saus deploy` command.
   */
  deploy?: {
    /**
     * Path to the module that declares deploy targets.
     */
    entry: string
    /**
     * Which GitHub repository to use for the deployment cache.
     *
     * By default, Saus tries to parse this value from your `origin`
     * repository URL (as listed by `git remote` command).
     */
    githubRepo?: string
    /**
     * GitHub access token so the SSR bundle can load metadata
     * from the deployment cache.
     */
    githubToken?: string
  }
  /**
   * How many pages can be rendered at once.
   * @default os.cpus().length
   */
  renderConcurrency?: number
  /**
   * Where are state modules served from?
   * @default "/.saus/state/"
   */
  stateModuleBase?: string
  /**
   * Assume this page path when using the default route in build mode
   * and SSR mode.
   * @default "/404"
   */
  defaultPath?: string
  /**
   * The number of seconds each HTML processor has before a timeout
   * error is thrown.
   *
   * Set to `0` to disable timeouts.
   * @default 10
   */
  htmlTimeout?: number
  /**
   * The number of seconds each SSR module is given to load.
   *
   * Set to `0` to disable timeouts.
   * @default 10
   */
  requireTimeout?: number
  /**
   * Options for the SSR bundle generated by `saus bundle`.
   */
  bundle?: UserBundleConfig
}

declare module 'rollup' {
  interface PartialResolvedId {
    /**
     * Use `false` to prevent this module from being reloaded.
     *
     * Perfect for singleton modules that should be shared between
     * modules inside and outside the SSR module graph.
     */
    reload?: boolean
  }
}

declare module 'vite' {
  interface UserConfig {
    saus?: Partial<SausConfig>
    /**
     * You can't use `saus test` command until this is defined.
     */
    testFramework?: (
      config: import('./vite').UserConfig
    ) => Promise<TestPlugin | { default: TestPlugin }>
    /**
     * Filter the stack trace from an SSR error so there's
     * less noise from files you don't care about.
     */
    filterStack?: (source: string) => boolean
  }

  interface Plugin {
    /**
     * Provide plugin hooks specific to Saus.
     *
     * If a function is given, it's called after the `SausContext`
     * object is created or replaced (when the dev server is
     * restarted).
     */
    saus?:
      | SausPlugin
      | ((
          context: SausContext,
          config: vite.ResolvedConfig
        ) => Promisable<SausPlugin | void>)
  }

  interface IndexHtmlTransformMetadata {
    page: RenderedPage
  }
}

export interface UserConfig
  extends Omit<vite.UserConfig, 'build' | 'publicDir'> {
  saus: SausConfig
  build?: BuildOptions
  /**
   * Public directory settings.
   *
   * Files in the `publicDir` are copied into the `build.outDir` after
   * plugins get a chance to transform them.
   *
   * Use `false` to disable this feature.
   */
  publicDir?: false | string | PublicDirOptions
}

export interface BuildOptions extends vite.BuildOptions {
  /** Skip certain pages when pre-rendering. */
  skip?: (pagePath: string) => boolean
  /** Force a rebundle. */
  force?: boolean
  /** The bundle's mode (usually `development` or `production`) */
  mode?: string
  /**
   * Limit the number of worker threads.  \
   * Use `0` to run on the main thread only.
   */
  maxWorkers?: number
  /** The directory to load the cached bundle from. */
  cacheDir?: string
  /** Used to stop rendering the remaining pages. */
  abortSignal?: AbortSignal
  /** Include `sourcesContent` is cached bundle sourcemap. */
  sourcesContent?: boolean
}

type Promisable<T> = T | Promise<T>

export const defineConfig = vite.defineConfig as (
  config:
    | Promisable<vite.UserConfig>
    | ((env: vite.ConfigEnv) => Promisable<vite.UserConfig>)
) => vite.UserConfigExport

/**
 * Saus plugins are returned by the `saus` hook of a Vite plugin.
 */
export interface SausPlugin {
  /** Used for debugging. If undefined, the Vite plugin name is used. */
  name?: string
  /**
   * Transform files from the `publicDir` when the `copyPublicDir`
   * plugin is active in the project.
   */
  transformPublicFile?: (file: PublicFile) => Promisable<void>
  /**
   * Generate runtime code for development/production and client/server.
   * @experimental
   */
  injectModules?: (api: ModuleInjection) => Promisable<void>
  /**
   * Inspect or mutate the `RuntimeConfig` object, which is serialized to
   * JSON and used by the SSR bundle. The runtime config is also used
   * in development.
   */
  onRuntimeConfig?: (config: RuntimeConfig) => Promisable<void>
  /**
   * Called after the routes are loaded or reloaded. \
   * Adding or mutating routes in this hook is discouraged.
   */
  receiveRoutes?: (context: SausContext) => Promisable<void>
  /**
   * Called after the dev app is created or replaced.
   */
  receiveDevApp?: (app: App) => Promisable<void>
  /**
   * Called before the SSR bundle is written to disk.
   *
   * ⚠︎ This is only called when `saus bundle` is used.
   */
  receiveBundle?: (
    bundle: OutputBundle,
    options: Readonly<BundleOptions>
  ) => Promisable<void>
  /**
   * Called before the SSR bundle is generated.
   *
   * ⚠︎ This is only called when `saus bundle` is used.
   */
  receiveBundleOptions?: (options: BundleOptions) => Promisable<void>
  /**
   * Called before rendered pages are written to disk.
   *
   * ⚠︎ This is only called when `saus build` is used.
   */
  onWritePages?: (pages: PageBundle[]) => Promisable<void>
  /**
   * In development only, SSR errors can be sent to the browser
   * for a better developer experience. The default behavior is
   * minimal but overridable via this plugin hook.
   */
  renderErrorReport?: (req: Endpoint.Request, error: any) => Promisable<string>
}
