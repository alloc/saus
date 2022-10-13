import exec from '@cush/exec'

const nothingToCommitRE = /\bnothing\b.*? to commit\b/

/**
 * Commit the staged changes in a repository, ignoring non-zero exit codes
 * when “nothing to commit” is found in the output logs.
 *
 * Not available in a production SSR context.
 */
export function createCommit(message: string, ...args: exec.SyncArgs) {
  const stdout = exec.sync(`git commit -m`, [message], ...args, {
    noThrow: nothingToCommitRE,
  })
  return {
    stdout,
    success: !nothingToCommitRE.test(stdout),
  }
}
