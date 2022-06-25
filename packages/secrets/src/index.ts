export * from './git'
export * from './unsafe'

/**
 * Read deployed secrets from your GitHub repository. \
 * You need to call `useGitSecrets` in your deploy file for this
 * to work correctly.
 *
 * ⚠︎ Available in SSR bundle only.
 *
 * During development, this function resolves with an empty object.
 *
 * @param repoId - The repository ID, like "user/project"
 * @param authToken - For private repository access
 * @param password - Used to decrypt the secrets file
 */
export async function loadGitHubSecrets(
  repoId: string,
  authToken: string,
  password: string
) {
  return {} as Record<string, string>
}
