import exec from '@cush/exec'
import { readFileSync } from 'fs'
import os from 'os'
import path from 'path'
import * as yaml from 'yaml'
import { ResolvedConfig } from './vite'

export async function resolveGitHubCreds(context: {
  root: string
  config: ResolvedConfig
}) {
  const githubRepo = await resolveGitHubRepo(context)
  if (githubRepo) {
    const githubToken = await resolveGitHubToken(context)
    return { githubRepo, githubToken }
  }
  return {}
}

export async function resolveGitHubRepo(context: {
  root: string
  config: ResolvedConfig
}) {
  const { deploy: deployConfig } = context.config.saus
  if (deployConfig?.githubRepo) {
    return deployConfig.githubRepo
  }
  if (await hasDeployedBranch(context, 'origin')) {
    const { url } = await getGitRepoByName('origin', context)
    const match = /github\.com[/:]([^/]+\/[^/]+?)(\/|\.git|$)/.exec(url)
    return match?.[1]
  }
}

async function hasDeployedBranch(context: { root: string }, remote: string) {
  return (await exec('git branch -a', { cwd: context.root }))
    .split(/\n */g)
    .some(branch => branch == `remotes/${remote}/deployed`)
}

export async function resolveGitHubToken(context: {
  root: string
  config: ResolvedConfig
}) {
  if (process.env.GH_TOKEN) {
    return process.env.GH_TOKEN
  }
  const { deploy: deployConfig } = context.config.saus
  if (deployConfig?.githubToken) {
    return deployConfig.githubToken
  }
  try {
    // TODO: change this to opt-in (via plugin?)
    const hostsFile = path.join(os.homedir(), '.config/gh/hosts.yml')
    const hosts = yaml.parse(readFileSync(hostsFile, 'utf8'))
    return hosts['github.com'].oauth_token as string | undefined
  } catch {}
}

export interface GitRepo {
  type: 'fetch' | 'push'
  name: string
  url: string
}

export async function getGitRepoByName(
  name: string,
  context: { root: string }
): Promise<GitRepo> {
  const remotes = parseRemotes(
    await exec('git remote -v', { cwd: context.root })
  )
  const repo = remotes.find(repo => repo.type == 'push' && repo.name == name)
  if (!repo) {
    throw Error('[saus] Repository not found: ' + name)
  }
  return repo
}

function parseRemotes(text: string): GitRepo[] {
  return text.split('\n').map(line => {
    const [name, url, type] = line.split(/\s+/)
    return { type: type.slice(1, -1) as 'fetch' | 'push', name, url }
  })
}
