import { getGitRepoByName } from '@/git'
import { toSausPath } from '@/paths'
import { vite } from '@/vite'
import exec from '@cush/exec'
import { noop } from '@utils/noop'
import { ModuleMap } from '@vm/moduleMap'
import { injectNodeModule } from '@vm/nodeModules'
import { RequireAsync } from '@vm/types'
import fs from 'fs'
import path from 'path'
import { PackageJson, Promisable } from 'type-fest'
import { BundleContext, loadBundleContext } from '../bundle/context'
import { SecretHub } from '../secrets/hub'
import { secretsPlugin } from '../secrets/plugin'
import { GitFiles } from './files'
import { loadDeployPlugin } from './loader'
import { DeployOptions } from './options'
import { createPluginCache, PluginCache } from './pluginCache'
import { syncDeployCache } from './sync'
import {
  DeployAction,
  DeployHookRef,
  DeployPlugin,
  DeployTargetArgs,
  RevertFn,
} from './types'

export interface DeployContext extends BundleContext {
  command: 'deploy' | 'secrets'
  /** The file path of the deployment plan. */
  deployPath: string
  files: GitFiles
  secrets: SecretHub
  /** Set this to true if your deploy action has side effects. */
  effective: boolean
  /** The `package.json` file found in project root. */
  rootPackage: PackageJson
  /** The HEAD commit of the project repository. */
  lastCommitHash: string
  /** The header of the project's HEAD commit. Includes hash and title, but not message body. */
  lastCommitHeader: string
  /** For git operations, deploy to this repository. */
  gitRepo: { name: string; url: string }
  /** When true, skip any real deployment. */
  dryRun: boolean
  /** Avoid using cached build artifacts. */
  noCache: boolean
  /** Plugins should use this for deployment logs. */
  logActivity: (...args: any[]) => void
  /** Plugins should use this for successful deployment logs. */
  logSuccess: (...args: any[]) => void
  /**
   * Plugins use this to describe an action and track its completion.
   *
   * The `msg` string should start with a present-tense verb.
   */
  logPlan: <T>(msg: string, action?: () => Promisable<T>) => Promise<T>
  //
  // Internals
  //
  targets: DeployTargetArgs[]
  revertFns: RevertFn[]
  deployHooks: DeployHookRef[]
  deployPlugins: PluginCache<string | DeployHookRef, DeployPlugin>
  addDeployTarget: (...args: DeployTargetArgs) => any
  addDeployAction: <T>(action: DeployAction<T>) => Promise<T>
  syncDeployCache: () => Promise<void>
  moduleMap: ModuleMap
  require: RequireAsync
  ssrRequire: RequireAsync
}

export async function loadDeployContext(
  options: DeployOptions = {},
  inlineConfig?: vite.UserConfig
): Promise<DeployContext> {
  const context = await loadBundleContext<DeployContext>(options, {
    mode: 'production',
    ...inlineConfig,
  })

  const { deploy: deployConfig } = context.config.saus
  if (!deployConfig) {
    throw Error('[saus] Cannot deploy without `saus.deploy` configured')
  }

  context.deployPath = path.resolve(context.root, deployConfig.entry)

  const plugins = context.config.plugins as vite.Plugin[]
  plugins.unshift(secretsPlugin(context.deployPath))

  context.rootPackage = JSON.parse(
    fs.readFileSync(path.join(context.root, 'package.json'), 'utf8')
  )

  context.gitRepo =
    options.gitRepo || (await getGitRepoByName('origin', context))

  context.lastCommitHash = await exec('git rev-parse --short head', {
    cwd: context.root,
  })

  context.lastCommitHeader = await exec('git log -1 --oneline', {
    cwd: context.root,
  })

  const cacheDir = path.resolve(context.root, 'node_modules/.saus/deployed')
  fs.mkdirSync(cacheDir, { recursive: true })

  // This is a heavy operation, so avoid doing it until necessary.
  let syncPromise: Promise<void> | undefined
  context.syncDeployCache = () =>
    (syncPromise ||= syncDeployCache(
      cacheDir,
      'deployed',
      context.gitRepo,
      context.files
    ))

  context.command = options.command || 'deploy'
  context.files = new GitFiles(cacheDir, options.dryRun)
  context.secrets = new SecretHub()
  context.dryRun = !!options.dryRun
  context.noCache = !!options.noCache
  context.targets = []
  context.revertFns = []
  context.deployHooks = []
  context.deployPlugins = createPluginCache(loadDeployPlugin)

  context.logActivity = noop
  context.logSuccess = noop
  context.logPlan = () => {
    throw 'logPlan cannot be called yet'
  }

  // By default, a deployment action will never resolve.
  // This affects `saus secrets add` for example, so unnecessary
  // calls are avoided.
  context.addDeployAction = () => new Promise(noop)

  injectDeployContext(context)
  return context
}

let contextPath: string | undefined

export function getDeployContext(): DeployContext
export function getDeployContext(unsure: true): DeployContext | null
export function getDeployContext() {
  return contextPath ? (void 0, require)(contextPath) : null
}

export function injectDeployContext(context: DeployContext) {
  // Note: The __dirname here equals the path of the `dist` directory,
  // because this function is extracted into a common chunk and all
  // common chunks are stored in the `dist` directory.
  contextPath = toSausPath('core/context.cjs')
  injectNodeModule(contextPath, context)
}
