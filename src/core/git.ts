import exec from '@cush/exec'

export const getRawGitHubUrl = (opts: {
  token: string
  repo: string
  branch: string
  file: string
}) =>
  `https://${opts.token}@raw.githubusercontent.com/${opts.repo}/${opts.branch}/${opts.file}`

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
