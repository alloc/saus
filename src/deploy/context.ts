import { getRequireFunctions } from '@/getRequireFunctions'
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
import { SecretHub } from '../secrets/hub'
import { secretsPlugin } from '../secrets/plugin'
import { GitFiles } from './files'
import { DeployOptions } from './options'
import {
  DeployAction,
  DeployHookRef,
  DeployPlugin,
  DeployTarget,
} from './types'

export type DeployTargetArgs = [
  hook: DeployHookRef,
  target: Promisable<DeployTarget>,
  resolve: (outputs: any) => void
]

export interface DeployContext extends Omit<BundleContext, 'command'> {
  command: 'deploy' | 'secrets'
  /** The file path of the deployment plan. */
  deployPath: string
  files: GitFiles
  secrets: SecretHub
  /** The `package.json` file found in project root. */
  rootPackage: PackageJson
  /** The HEAD commit of the project repository. */
  lastCommitHash: string
  /** For git operations, deploy to this repository. */
  gitRepo: { name: string; url: string }
  /** When true, skip any real deployment. */
  dryRun: boolean
  deployHooks: DeployHookRef[]
  deployPlugins: Record<string, DeployPlugin>
  addDeployTarget: (...args: DeployTargetArgs) => void
  addDeployAction: <T>(action: DeployAction<T>) => Promise<T>
  syncDeployCache: () => Promise<void>
  //
  // Module context
  //
  moduleMap: ModuleMap
  require: RequireAsync
  ssrRequire: RequireAsync
}

export async function loadDeployContext(
  options: DeployOptions = {},
  inlineConfig: vite.UserConfig = {}
): Promise<DeployContext> {
  const context = await loadBundleContext<DeployContext>(options, inlineConfig)

  const { deploy: deployConfig } = context.config.saus
  if (!deployConfig) {
    throw Error('[saus] Cannot deploy without `saus.deploy` configured')
  }

  context.deployPath = path.resolve(context.root, deployConfig.entry)

  // @ts-ignore
  context.config.plugins.unshift(secretsPlugin(context.deployPath))

  context.rootPackage = JSON.parse(
    fs.readFileSync(path.join(context.root, 'package.json'), 'utf8')
  )

  context.gitRepo =
    options.gitRepo || (await getGitRepoByName('origin', context))

  context.lastCommitHash = await exec('git rev-parse --short head', {
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
  context.secrets = new SecretHub(context)
  context.dryRun = !!options.dryRun
  context.deployHooks = []

  // By default, a deployment action will never resolve.
  // This affects `saus secrets add` for example, so unnecessary
  // calls are avoided.
  context.addDeployAction = () => new Promise(noop)

  context.moduleMap = {}
  Object.assign(context, getRequireFunctions(context))

  injectDeployContext(context)
  return context
}

const contextPath = path.resolve(__dirname, '../core/context.cjs')

export function getDeployContext() {
  return (void 0, require)(contextPath) as DeployContext
}

export function injectDeployContext(context: DeployContext) {
  injectNodeModule(contextPath, context)
}

async function syncDeployCache(
  cacheDir: string,
  targetBranch: string,
  { gitRepo }: DeployContext
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
  } catch (e: any) {
    if (!init || !/Couldn't find remote ref/.test(e.message)) {
      throw e
    }
    await exec('git commit -m "init" --allow-empty', { cwd: cacheDir })
    await exec('git push -u', [gitRepo.name, 'master:' + targetBranch], {
      cwd: cacheDir,
    })
  }
}
