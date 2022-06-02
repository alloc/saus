import fs from 'fs'
import path from 'path'
import { BundleOptions } from '../bundle'
import { callPlugins } from '../utils/callPlugins'
import { SourceMap } from '../utils/sourceMap'
import { BundleContext, InlineBundleConfig, loadBundleContext } from './bundle'
import { MutableRuntimeConfig, RuntimeConfig } from './config'
import { vite } from './vite'

type RuntimeConfigFn = (context: BundleContext) => Partial<RuntimeConfig>

export interface LoadBundleConfig extends InlineBundleConfig {
  /** Load a bundle from the compile cache → `node_modules/.saus` */
  cached?: boolean
  /** Where the bundle should be loaded from or saved to. */
  bundlePath?: string
  /** Customize the Saus bundle */
  bundle?: BundleOptions
  /** Vite config merged into `vite.config.ts` */
  config?: vite.UserConfig
  /** Saus runtime config overrides */
  runtimeConfig?: Partial<RuntimeConfig> | RuntimeConfigFn
}

export async function loadBundle({
  bundlePath,
  bundle: bundleOptions,
  config,
  runtimeConfig: runtimeUserConfig,
  ...options
}: LoadBundleConfig = {}) {
  const context = await loadBundleContext(options, {
    mode: 'production',
    ...config,
  })

  const bundleFile = `bundle.${context.config.mode}.js`
  if (options.cached) {
    bundlePath = path.join(context.compileCache.path, bundleFile)
  }

  type Bundle = { code: string; map?: SourceMap; cached?: true }

  let bundleResult: Bundle
  if (bundlePath && fs.existsSync(bundlePath)) {
    const code = fs.readFileSync(bundlePath, 'utf8')
    bundleResult = { code, cached: true }
  } else {
    const { bundle } = require('../bundle') as typeof import('../bundle')
    bundleResult = await bundle(bundleOptions, context)
  }

  let { code, map, cached } = bundleResult
  if (!cached) {
    context.compileCache.set(bundleFile, code)
  }

  const mapFile = bundleFile + '.map'
  if (map) {
    context.compileCache.set(mapFile, JSON.stringify(map))
    code += '\n//# sourceMappingURL=' + mapFile
  }

  const runtimeConfig: Partial<MutableRuntimeConfig> | undefined = cached && {
    ...pick(context.config.build, ['assetsDir']),
    ...pick(context.config.saus, [
      'delayModulePreload',
      'htmlTimeout',
      'renderConcurrency',
      'stripLinkTags',
    ]),
    ...(typeof runtimeUserConfig == 'function'
      ? (runtimeUserConfig as RuntimeConfigFn)(context)
      : runtimeUserConfig),
  }

  await callPlugins(
    context.plugins,
    'onRuntimeConfig',
    runtimeConfig as RuntimeConfig
  )

  return {
    bundle: bundleResult,
    bundlePath: path.join(context.compileCache.path, bundleFile),
    runtimeConfig,
    context,
  }
}

function pick<T, P extends (keyof T)[]>(
  obj: T,
  keys: P,
  filter: (value: any, key: P[number]) => boolean = () => true
): Pick<T, P[number]> {
  const picked: any = {}
  for (const key of keys) {
    const value = obj[key]
    if (filter(value, key)) {
      picked[key] = value
    }
  }
  return picked
}
