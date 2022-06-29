import exec from '@cush/exec'
import { execSync } from 'child_process'

export const getRawGitHubUrl = (opts: {
  token: string
  repo: string
  branch: string
  file: string
}) =>
  `https://${opts.token}@raw.githubusercontent.com/${opts.repo}/${opts.branch}/${opts.file}`

export function getCurrentGitBranch() {
  return execSync('git rev-parse --abbrev-ref HEAD').toString('utf8').trim()
}

export function createCommit(message: string, ...args: exec.Args) {
  return exec(`git commit -m`, [message], ...args, {
    noThrow: /nothing to commit/,
  })
}
