import { warn } from 'misty'
import path from 'path'
import { renderPlugin } from '../../plugins/render'
import { loadContext, SausContext } from '../context'
import { SausBundleConfig, vite } from '../vite'

export interface InlineBundleConfig
  extends Pick<SausBundleConfig, 'debugBase' | 'entry' | 'format' | 'target'> {
  outFile?: string
  write?: boolean
}

type RequiredKeys<T, P extends keyof T> = {} & Omit<T, P> & Required<Pick<T, P>>

/** @internal */
export interface BundleConfig
  extends RequiredKeys<SausBundleConfig, 'format' | 'type' | 'target'> {
  outFile?: string
}

export interface BundleContext extends SausContext {
  bundle: BundleConfig
}

export async function loadBundleContext(
  options: InlineBundleConfig = {},
  inlineConfig: vite.UserConfig = {}
) {
  const context: BundleContext = (await loadContext('build', inlineConfig, [
    renderPlugin,
  ])) as any

  const bundleConfig = context.config.saus.bundle || {}
  const buildConfig = context.userConfig.build || {}

  let {
    debugBase = bundleConfig.debugBase,
    entry,
    format = bundleConfig.format || 'cjs',
    outFile,
    target = bundleConfig.target || 'node14',
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

  if (entry === undefined) {
    entry = bundleConfig.entry
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

  context.bundle = {
    ...bundleConfig,
    type: bundleConfig.type || 'script',
    entry,
    target,
    format,
    outFile,
    debugBase,
  }

  return context
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
