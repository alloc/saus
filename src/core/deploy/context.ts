import exec from '@cush/exec'
import fs from 'fs'
import path from 'path'
import { Promisable } from 'type-fest'
import { BundleContext, loadBundleContext } from '../bundle'
import { injectDeployContext } from '../deploy'
import { GitFiles } from './files'
import { DeployOptions } from './options'
import { SecretHub } from './secrets'

export interface DeployContext extends Omit<BundleContext, 'command'> {
  command: 'deploy' | 'secrets'
  files: GitFiles
  secrets: SecretHub
  /** For git operations, deploy to this repository. */
  gitRepo: { name: string; url: string }
  /** When true, skip any real deployment. */
  dryRun: boolean
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

  injectDeployContext(context)
  return context
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
