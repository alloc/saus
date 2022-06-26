import { execSync } from 'child_process'
import fs from 'fs'
import { green } from 'kleur/colors'
import path from 'path'
import { BundleOptions, OutputBundle } from '../bundle'
import {
  BundleConfig,
  BundleContext,
  InlineBundleConfig,
  loadBundleContext,
} from '../bundle/context'
import { getDeployContext } from '../deploy'
import { SourceMap } from './node/sourceMap'
import { MutableRuntimeConfig, RuntimeConfig } from './runtime/config'
import { callPlugins } from './utils/callPlugins'
import { md5Hex } from './utils/md5-hex'
import { pick } from './utils/pick'
import { readJson } from './utils/readJson'
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
  const context =
    getDeployContext() ||
    (await loadBundleContext(options, {
      mode: 'production',
      ...config,
    }))

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

  let metaFile = bundleFile.replace(/\.js$/, '.meta.json')
  let metaPath: string | undefined

  let cached = false
  let bundleResult: OutputBundle | undefined
  if (bundlePath && !options.force) {
    metaPath = bundlePath.replace(bundleFile, metaFile)
    try {
      const lastCommitDate = new Date(
        execSync('git log -1 --format=%cd', { cwd: context.root }).toString()
      )
      const { mtime } = fs.statSync(bundlePath)
      if (mtime > lastCommitDate) {
        const code = fs.readFileSync(bundlePath, 'utf8')
        const meta = readJson(metaPath)
        bundleResult = { ...meta, code }
        cached = true

        if (context.command == 'deploy') {
          context.logger.info(green('✔︎') + ' Using cached bundle.')
        }
      }
    } catch (e: any) {
      if (e.code !== 'ENOENT') {
        throw e
      }
    }
  }
  if (!bundleResult) {
    const { bundle } =
      require('../bundle/api') as typeof import('../bundle/api')
    bundleResult = await bundle(context, bundleOptions)
  }

  let { code, map, ...meta } = bundleResult
  if (!cached) {
    context.compileCache.set(bundleFile, code)
    context.compileCache.set(metaFile, JSON.stringify(meta))
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
