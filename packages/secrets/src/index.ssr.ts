import { AESEncryption } from 'aes-password'
import { deployedEnv, getRawGitHubUrl } from 'saus/core'
import { http } from 'saus/http'

export async function loadGitHubSecrets(
  repoId: string,
  authToken: string,
  password: string
) {
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
