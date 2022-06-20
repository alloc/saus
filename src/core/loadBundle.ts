import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { BundleOptions } from '../bundle'
import { callPlugins } from '../utils/callPlugins'
import { md5Hex } from '../utils/md5-hex'
import { pick } from '../utils/pick'
import { SourceMap } from '../utils/sourceMap'
import {
  BundleConfig,
  BundleContext,
  InlineBundleConfig,
  loadBundleContext,
} from './bundle'
import { MutableRuntimeConfig, RuntimeConfig } from './config'
import { vite } from './vite'

type RuntimeConfigFn = (context: BundleContext) => Partial<RuntimeConfig>

export interface LoadBundleConfig extends InlineBundleConfig {
  /** Force a rebundle. */
  force?: boolean
  /**
   * Which directory the bundle should be loaded from or saved to.
   * @default "node_modules/.saus"
   */
  cacheDir?: string
  /**
   * The bundle name, minus the hash and `.js` extension.
   * @default "bundle"
   */
  name?: string
  /** Customize the Saus bundle */
  bundle?: BundleOptions
  /** Vite config merged into `vite.config.ts` */
  config?: vite.UserConfig
  /** Saus runtime config overrides */
  runtimeConfig?: Partial<RuntimeConfig> | RuntimeConfigFn
}

export type LoadedBundle = { code: string; map?: SourceMap; cached?: true }

export async function loadBundle({
  name = 'bundle',
  cacheDir,
  bundle: bundleOptions = {},
  config,
  runtimeConfig: runtimeUserConfig,
  ...options
}: LoadBundleConfig = {}) {
  const context = await loadBundleContext(options, {
    mode: 'production',
    ...config,
  })

  const bundleHash = getBundleHash(
    context.config.mode,
    context.bundle,
    bundleOptions
  )

  const bundleFile = `${name}.${bundleHash}.js`
  const bundlePath = path.join(
    cacheDir || context.compileCache.path,
    bundleFile
  )

  let bundleResult: LoadedBundle | undefined
  if (bundlePath && !options.force) {
    try {
      const lastCommitDate = new Date(
        execSync('git log -1 --format=%cd', { cwd: context.root }).toString()
      )
      const { mtime } = fs.statSync(bundlePath)
      if (mtime > lastCommitDate) {
        const code = fs.readFileSync(bundlePath, 'utf8')
        bundleResult = { code, cached: true }
      }
    } catch (e: any) {
      if (e.code !== 'ENOENT') {
        throw e
      }
    }
  }
  if (!bundleResult) {
    const { bundle } = require('../bundle') as typeof import('../bundle')
    bundleResult = await bundle(context, bundleOptions)
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
      ? runtimeUserConfig(context)
      : runtimeUserConfig),
  }

  await callPlugins(
    context.plugins,
    'onRuntimeConfig',
    runtimeConfig as RuntimeConfig
  )

  return {
    bundle: bundleResult,
    bundleFile,
    bundlePath: path.join(context.compileCache.path, bundleFile),
    runtimeConfig,
    context,
  }
}

function getBundleHash(
  mode: string,
  config: BundleConfig,
  bundleOptions: BundleOptions
) {
  const values = {
    mode,
    type: config.type,
    entry: config.entry || null,
    target: config.target,
    format: config.format,
    moduleMap: config.moduleMap || 'inline',
    bundle: bundleOptions,
  }
  return md5Hex(JSON.stringify(values)).slice(0, 8)
}
