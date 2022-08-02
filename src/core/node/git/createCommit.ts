import exec from '@cush/exec'

/**
 * Commit the staged changes in a repository, ignoring non-zero exit codes
 * when “nothing to commit” is found in the output logs.
 *
 * Not available in a production SSR context.
 */
export function createCommit(message: string, ...args: exec.Args) {
  return exec(`git commit -m`, [message], ...args, {
    noThrow: /nothing to commit/,
  })
}
