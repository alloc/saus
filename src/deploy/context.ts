import { getGitRepoByName } from '@/git'
import { noop } from '@/utils/noop'
import { vite } from '@/vite'
import { injectNodeModule } from '@/vm/nodeModules'
import { ModuleMap, RequireAsync } from '@/vm/types'
import exec from '@cush/exec'
import fs from 'fs'
import path from 'path'
import { PackageJson, Promisable } from 'type-fest'
import { BundleContext, loadBundleContext } from '../bundle/context'
import { createCommit } from '../core'
import { SecretHub } from '../secrets/hub'
import { secretsPlugin } from '../secrets/plugin'
import { GitFiles } from './files'
import { loadDeployPlugin } from './loader'
import { DeployOptions } from './options'
import { createPluginCache, PluginCache } from './pluginCache'
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
  addDeployTarget: (...args: DeployTargetArgs) => void
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
    (syncPromise ||= syncDeployCache(cacheDir, 'deployed', context))

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
  contextPath = path.resolve(__dirname, '../core/context.cjs')
  injectNodeModule(contextPath, context)
}

async function syncDeployCache(
  cacheDir: string,
  targetBranch: string,
  { gitRepo, files }: DeployContext
) {
  let init: boolean
  if ((init = !fs.existsSync(path.join(cacheDir, '.git')))) {
    await exec('git init', { cwd: cacheDir })
    await exec('git remote add', [gitRepo.name, gitRepo.url], {
      cwd: cacheDir,
    })
  }
  try {
    await exec('git pull --depth 1', [gitRepo.name, targetBranch], {
      cwd: cacheDir,
    })
    if (init) {
      await exec('git branch -u', [gitRepo.name + '/deployed'], {
        cwd: cacheDir,
      })
    }
  } catch (e: any) {
    if (!init || !/Couldn't find remote ref/.test(e.message)) {
      throw e
    }
    files.get('.gitignore').setBuffer('deploy.lock', 'utf8')
    await exec('git add .gitignore', { cwd: cacheDir })
    await createCommit('init', { cwd: cacheDir })
    await exec('git push -u', [gitRepo.name, 'master:' + targetBranch], {
      cwd: cacheDir,
    })
  }
}
