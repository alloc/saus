import { prompt } from '@saus/deploy-utils'
import { AESEncryption } from 'aes-password'
import { createCommit, exec, pickAllExcept } from 'saus/core'
import { File, getDeployContext, SecretMap } from 'saus/deploy'

/**
 * Use secrets stored in your git repository and
 * encrypted-at-rest with a password.
 */
export function useGitSecrets() {
  const { secrets, files, logger, syncDeployCache } = getDeployContext()

  const secretsFile = files.get('secrets.aes', SecretsFile)
  const beforeFileAccess = once(() =>
    Promise.all([requestPassword(), syncDeployCache()])
  )

  secrets.addSource({
    name: 'Git Secrets',
    async load() {
      if (secretsFile.exists) {
        logger.info('\nUsing git for encrypted secret storage.')
        await beforeFileAccess()
        return secretsFile.getData()
      }
      return {}
    },
    async set(secrets, replace) {
      await beforeFileAccess()
      if (secretsFile.exists && !replace) {
        secrets = Object.assign(await secretsFile.getData(), secrets)
      }
      await secretsFile.setData(secrets)
      await commitUpdates()
    },
    async unset(names) {
      await beforeFileAccess()
      if (!secretsFile.exists) {
        return logger.warn('No secrets were found.')
      }
      const secrets = pickAllExcept(await secretsFile.getData(), names)
      await secretsFile.setData(secrets)
      await commitUpdates()
    },
  })

  async function requestPassword() {
    while (true) {
      const { password } = await prompt({
        name: 'password',
        type: 'password',
        message: secretsFile.exists ? 'Password' : 'New password',
      })
      if (!password) {
        throw Error('[saus] Operation canceled.')
      }
      if (!secretsFile.exists) {
        const { confirmation } = await prompt({
          name: 'confirmation',
          type: 'password',
          message: 'Confirm password',
        })
        if (password !== confirmation) {
          logger.info('Passwords did not match! Try again.', { clear: true })
          continue
        }
      }
      secretsFile.setPassword(password)
      break
    }
  }

  async function commitUpdates() {
    if (!files.dryRun) {
      await exec(`git add`, [secretsFile.name], { cwd: files.root })
      await createCommit('update secrets.aes', {
        cwd: files.root,
      })
      await exec(`git push`, { cwd: files.root })
    }
  }
}

class SecretsFile extends File {
  private _password = ''
  setPassword(pass: string) {
    this._password = pass
  }
  async getData(): Promise<SecretMap> {
    const encrypted = this.getBuffer('utf8')
    const decrypted = await AESEncryption.decrypt(encrypted, this._password)
    return JSON.parse(decrypted)
  }
  async setData(data: SecretMap) {
    if (Object.keys(data).length) {
      const decrypted = JSON.stringify(data)
      const encrypted = await AESEncryption.encrypt(decrypted, this._password)
      this.setBuffer(Buffer.from(encrypted))
    } else {
      this.delete()
    }
  }
}

function once<T extends (...args: any[]) => any>(fn: T): T {
  let called = false
  let result: any
  return ((...args: any[]) => {
    if (called) {
      return result
    }
    called = true
    return (result = fn(...args))
  }) as any
}
