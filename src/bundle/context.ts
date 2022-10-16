import { BaseContext, loadContext, SausContext } from '@/context'
import { getRequireFunctions } from '@/getRequireFunctions'
import { getSausPlugins } from '@/getSausPlugins'
import { loadRoutes } from '@/loadRoutes'
import { createModuleProvider } from '@/plugins/moduleProvider'
import {
  moduleRedirection,
  overrideBareImport,
} from '@/plugins/moduleRedirection'
import {
  BundleConfig,
  BundleConfigDefaults,
  UserBundleConfig,
  vite,
} from '@/vite'
import { getViteFunctions } from '@/vite/functions'
import { assignDefaults } from '@utils/assignDefaults'
import { plural } from '@utils/plural'
import { warn } from 'misty'
import { startTask } from 'misty/task'
import path from 'path'
import { internalRedirects, ssrRedirects } from './moduleRedirects'
import { preBundleSsrRuntime } from './runtimeBundle'

type InheritedKeys = 'debugBase' | 'entry' | 'format' | 'clientStore' | 'target'

export interface InlineBundleConfig
  extends Pick<UserBundleConfig, InheritedKeys> {
  appVersion?: string
  outFile?: string
  write?: boolean
}

/** Used by both `saus build` and `saus bundle` commands. */
export interface BuildContext extends BundleContext {
  command: 'build'
}

/** When `loadBundleContext` is used, this is the context type. */
export interface BundleContext extends BaseContext {
  loadRoutes: () => Promise<void>
  bundle: BundleConfig & { write: boolean | undefined }
  /** The virtual module ID of the SSR bundle. */
  bundleModuleId: string
  /**
   * These plugins must be used whenever bundling a set of modules
   * that could import from the `saus` package.
   */
  bundlePlugins: vite.Plugin[]
  /**
   * Instead of writing public files to `build.outDir`,
   * call this function with each public file.
   */
  onPublicFile?: (name: string, data: Buffer) => void
}

export async function loadBundleContext<
  T extends BundleContext = BundleContext
>(
  options: InlineBundleConfig & { config?: vite.UserConfig } = {},
  inlineConfig: vite.UserConfig = options.config || {}
): Promise<T> {
  const context = await loadContext<BundleContext>('build', {
    config: inlineConfig,
  })

  context.injectedModules = createModuleProvider({ root: context.root })
  context.plugins = await getSausPlugins(context as SausContext)

  const { config } = context

  const buildConfig = context.userConfig.build || {}
  const bundleConfig = assignDefaults(
    { ...config.saus.bundle },
    BundleConfigDefaults
  )

  let {
    debugBase = bundleConfig.debugBase,
    entry = bundleConfig.entry || null,
    format = bundleConfig.format,
    outFile,
    clientStore = bundleConfig.clientStore,
    target = bundleConfig.target,
    write = buildConfig.write,
  } = options

  if (outFile) {
    outFile = path.resolve(outFile)
  }

  if (debugBase) {
    const failure = validateDebugBase(debugBase, context.basePath)
    if (failure) {
      warn(`"debugBase" ${failure}`)
      debugBase = undefined
    }
  }

  if (entry) {
    outFile ??= path.resolve(
      context.root,
      entry
        .replace(/^(\.\/)?src\//, (buildConfig.outDir || 'dist') + '/')
        .replace(/\.ts$/, format == 'cjs' ? '.js' : '.mjs')
    )
    entry = path.resolve(context.root, entry)
  }

  if (!outFile && write !== false) {
    throw Error(
      `[saus] The "outFile" option must be provided when ` +
        `"saus.bundle.entry" is not defined in your Vite config ` +
        `(and the "write" option is not false).`
    )
  }

  context.command = 'build'
  context.bundle = {
    ...bundleConfig,
    type: bundleConfig.type || 'script',
    entry,
    target,
    format,
    clientStore,
    outFile,
    debugBase,
    write,
  }

  // Disable @rollup/plugin-commonjs for SSR loading.
  config.plugins = config.plugins.filter(p => p.name !== 'commonjs')
  const pluginContainer = await vite.createPluginContainer(config)

  Object.assign(context, getViteFunctions(pluginContainer, { ssr: true }))
  Object.assign(context, getRequireFunctions(context as SausContext))

  context.loadRoutes = () => {
    const loading = (async () => {
      const task = context.logger.isLogged('info')
        ? startTask('Loading routes...')
        : null

      await loadRoutes(context as SausContext)

      const routeCount =
        context.routes.length +
        (context.defaultRoute ? 1 : 0) +
        (context.catchRoute ? 1 : 0)

      task?.finish(`${plural(routeCount, 'route')} loaded.`)
    })()

    context.loadRoutes = () => loading
    return loading
  }

  context.bundleModuleId = '\0saus/bundle.js'
  const redirects = [
    ...internalRedirects,
    ...ssrRedirects,
    overrideBareImport('saus/bundle', context.bundleModuleId),
  ]

  context.bundlePlugins = [
    preBundleSsrRuntime(context),
    moduleRedirection(redirects, [
      'vite',
      './client/index.mjs',
      './core/index.mjs',
      './core/context.mjs',
      './deploy/index.mjs',
      './utils/babel.mjs',
    ]),
  ]

  return context as any
}

function validateDebugBase(debugBase: string, base: string) {
  return !debugBase.startsWith('/')
    ? `must start with /`
    : !debugBase.endsWith('/')
    ? `must end with /`
    : base !== '/' && debugBase.startsWith(base)
    ? `must not include "base"`
    : null
}
