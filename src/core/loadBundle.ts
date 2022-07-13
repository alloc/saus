import { isObject } from '@saus/deploy-utils'
import * as base64ArrayBuffer from 'base64-arraybuffer'
import { execSync } from 'child_process'
import fs from 'fs'
import { green } from 'kleur/colors'
import path from 'path'
import { BundleOptions, OutputBundle } from '../bundle'
import {
  BuildContext,
  BundleContext,
  InlineBundleConfig,
  loadBundleContext,
} from '../bundle/context'
import { ClientAsset, ClientChunk } from '../bundle/types'
import { DeployContext, getDeployContext } from '../deploy'
import { SourceMap } from './node/sourceMap'
import { MutableRuntimeConfig, RuntimeConfig } from './runtime/config'
import { callPlugins } from './utils/callPlugins'
import { md5Hex } from './utils/md5-hex'
import { pick } from './utils/pick'
import { readJson } from './utils/readJson'
import { BundleConfig, vite } from './vite'
import { writeBundle } from './writeBundle'

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
  const context: BuildContext | DeployContext =
    getDeployContext(true) ||
    (await loadBundleContext(options, {
      mode: 'production',
      ...config,
    }))

  const noCache =
    options.force || (context.command == 'deploy' && context.noCache)

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

  let cached: true | undefined
  let bundleResult: OutputBundle | undefined
  if (bundlePath && !noCache) {
    metaPath = bundlePath.replace(bundleFile, metaFile)
    try {
      const lastCommitDate = new Date(
        execSync('git log -1 --format=%cd', { cwd: context.root }).toString()
      )
      const { mtime } = fs.statSync(bundlePath)
      if (mtime > lastCommitDate) {
        const code = fs.readFileSync(bundlePath, 'utf8')
        const meta = readJson(metaPath, (_, val) =>
          isObject(val)
            ? '@b' in val
              ? Buffer.from((val as any)['@b'], 'base64')
              : '@u8[]' in val
              ? new Uint8Array(base64ArrayBuffer.decode((val as any)['@u8[]']))
              : val
            : val
        )
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

  if (bundleResult) {
    if (context.bundle.write !== false) {
      const outDir = path.resolve(context.root, context.config.build.outDir)
      writeBundle(bundleResult, outDir, {
        writeIndexTypes: !context.bundle.entry,
        writeAssets:
          bundleOptions.forceWriteAssets ||
          context.bundle.clientStore == 'local',
      })
    }
  } else {
    const { bundle } =
      require('../bundle/api') as typeof import('../bundle/api')
    bundleResult = await bundle(context, bundleOptions)
  }

  let { code, map, ...meta } = bundleResult
  if (!cached) {
    // Temporarily replace Buffer#toJSON
    const bufferToJson = Buffer.prototype.toJSON
    Buffer.prototype.toJSON = undefined
    try {
      const metaJson = JSON.stringify(meta, (_, value) =>
        Buffer.isBuffer(value)
          ? { '@b': value.toString('base64') }
          : value instanceof Uint8Array
          ? { '@u8[]': base64ArrayBuffer.encode(value.buffer) }
          : isObject(value) && 'fileName' in value
          ? 'isEntry' in value
            ? serializeRollupChunk(value as ClientChunk)
            : serializeRollupAsset(value as ClientAsset)
          : value
      )
      context.compileCache.set(metaFile, metaJson)
      context.compileCache.set(bundleFile, code)
    } finally {
      Buffer.prototype.toJSON = bufferToJson
    }
  }

  const mapFile = bundleFile + '.map'
  if (map) {
    context.compileCache.set(mapFile, JSON.stringify(map))
    code += '\n//# sourceMappingURL=' + mapFile
  }

  const runtimeConfig: Partial<MutableRuntimeConfig> | undefined = cached && {
    ...pick(context.config.build, ['assetsDir']),
    ...pick(context.config.saus, ['htmlTimeout', 'renderConcurrency']),
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
    cached,
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
    clientStore: config.clientStore!,
    bundle: bundleOptions,
  }
  return md5Hex(JSON.stringify(values)).slice(0, 8)
}

function serializeRollupChunk(chunk: ClientChunk) {
  const json = pick(chunk, [
    'fileName',
    'isEntry',
    'isDebug',
    'code',
  ]) as ClientChunk

  // The `modules` map is only for knowing which modules are
  // included in each chunk, so we can discard the metadata.
  if (!chunk.isDebug)
    json.modules = Object.fromEntries(
      Object.keys(chunk.modules).map(id => [id, 1])
    )

  return json
}

function serializeRollupAsset(asset: ClientAsset) {
  return pick(asset, ['fileName', 'source'])
}
