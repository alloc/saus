import { exec } from '@saus/deploy-utils'

/**
 * Get the current branch of `$PWD/.git`
 */
export function getCurrentGitBranch() {
  return exec.sync('git rev-parse --abbrev-ref HEAD')
}
