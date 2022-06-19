import exec from '@cush/exec'
import fs from 'fs'
import path from 'path'
import { Promisable } from 'type-fest'
import { injectNodeModule } from '../../vm/nodeModules'
import { ModuleMap, RequireAsync, ResolveIdHook } from '../../vm/types'
import { BundleContext, loadBundleContext } from '../bundle'
import { DeployTarget } from '../deploy'
import { getRequireFunctions } from '../getRequireFunctions'
import { getViteTransform } from '../viteTransform'
import { GitFiles } from './files'
import { DeployOptions } from './options'
import { SecretHub } from './secrets'
import { DeployHookRef, DeployPlugin } from './types'

export type DeployTargetArgs = [
  hook: DeployHookRef,
  target: Promisable<DeployTarget>,
  resolve: (outputs: any) => void
]

export interface DeployContext extends Omit<BundleContext, 'command'> {
  command: 'deploy' | 'secrets'
  files: GitFiles
  secrets: SecretHub
  /** For git operations, deploy to this repository. */
  gitRepo: { name: string; url: string }
  /** When true, skip any real deployment. */
  dryRun: boolean
  deployHooks: DeployHookRef[]
  deployPlugins: Record<string, DeployPlugin>
  addTarget: (...args: DeployTargetArgs) => void
  //
  // Module context
  //
  moduleMap: ModuleMap
  resolveId: ResolveIdHook
  require: RequireAsync
  ssrRequire: RequireAsync
}

export async function prepareDeployContext(
  options: DeployOptions = {},
  bundleContext: Promisable<BundleContext> = loadBundleContext()
): Promise<DeployContext> {
  const context: DeployContext = (await bundleContext) as any

  context.gitRepo =
    options.gitRepo || (await getGitRepoByName('origin', context))

  const cacheDir = path.resolve(context.root, 'node_modules/.saus/deployed')
  fs.mkdirSync(cacheDir, { recursive: true })
  await pullCachedTargets(cacheDir, 'deployed', context)

  context.command = options.command || 'deploy'
  context.files = new GitFiles(cacheDir, options.dryRun)
  context.secrets = new SecretHub()
  context.dryRun = !!options.dryRun
  context.deployHooks = []

  const { pluginContainer } = await getViteTransform(context.config)

  context.moduleMap = {}
  context.resolveId = (id, importer) =>
    pluginContainer.resolveId(id, importer!, { ssr: true })

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

async function pullCachedTargets(
  cacheDir: string,
  targetBranch: string,
  { gitRepo }: DeployContext
) {
  if (!fs.existsSync(path.join(cacheDir, '.git'))) {
    await exec('git init', { cwd: cacheDir })
    await exec('git remote add', [gitRepo.name, gitRepo.url], {
      cwd: cacheDir,
    })
  }
  try {
    await exec('git pull', [gitRepo.name, targetBranch], { cwd: cacheDir })
  } catch (e: any) {
    if (!/Couldn't find remote ref/.test(e.message)) {
      throw e
    }
    await exec('git commit -m "init" --allow-empty', { cwd: cacheDir })
    await exec('git push -u', [gitRepo.name, 'master:' + targetBranch], {
      cwd: cacheDir,
    })
  }
}

async function getGitRepoByName(name: string, context: DeployContext) {
  const remotes = parseRemotes(
    await exec('git remote -v', { cwd: context.root })
  )
  const repo = remotes.find(repo => repo.type == 'push' && repo.name == name)
  if (!repo) {
    throw Error('[saus] Repository not found: ' + name)
  }
  return repo
}

function parseRemotes(text: string) {
  return text.split('\n').map(line => {
    const [name, url, type] = line.split(/\s+/)
    return { type: type.slice(1, -1) as 'fetch' | 'push', name, url }
  })
}
