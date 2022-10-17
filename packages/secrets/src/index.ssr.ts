import { AESEncryption } from 'aes-password'
import { deployedEnv } from 'saus'
import { http } from 'saus/http'
import { getRawGitHubUrl } from 'saus/node/getRawGitHubUrl'

// This function only exists in SSR bundle.
export async function loadGitHubSecrets(
  repoId: string,
  authToken = deployedEnv.githubToken,
  password = deployedEnv.password
) {
  if (!authToken) {
    throw Error('Missing github token')
  }
  if (!password) {
    throw Error('Missing project password')
  }

  const secretsUrl = getRawGitHubUrl({
    file: 'secrets.aes',
    repo: repoId,
    branch: 'deployed',
    token: authToken,
  })

  const resp = await http('get', secretsUrl)
  const decrypted = await AESEncryption.decrypt(
    resp.data.toString('utf8'),
    password
  )

  const secrets = JSON.parse(decrypted)
  Object.assign(deployedEnv, secrets)
  return secrets
}
