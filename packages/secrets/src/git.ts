import exec from '@cush/exec'
import { AESEncryption } from 'aes-password'
import { red } from 'kleur/colors'
import { File, getDeployContext, SecretMap } from 'saus/deploy'
import { createCommit } from 'saus/node/git/createCommit'
import { prompt } from 'saus/node/prompt'
import { pickAllExcept } from 'saus/utils/pick'

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
        return readSecrets()
      }
      return {}
    },
    async set(secrets, replace) {
      await beforeFileAccess()
      if (secretsFile.exists && !replace) {
        secrets = Object.assign(await readSecrets(), secrets)
      }
      await secretsFile.setData(secrets)
      await commitUpdates()
    },
    async unset(names) {
      await beforeFileAccess()
      if (!secretsFile.exists) {
        return logger.warn('No secrets were found.')
      }
      const secrets = pickAllExcept(await readSecrets(), names)
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

  async function readSecrets() {
    while (true) {
      try {
        return await secretsFile.getData()
      } catch (e: any) {
        if (/Authentication failed/.test(e.message)) {
          logger.error(red('Incorrect password!'), { clear: true })
          await requestPassword()
          continue
        }
        throw e
      }
    }
  }

  async function commitUpdates() {
    if (!files.dryRun) {
      await exec(`git add`, [secretsFile.name], { cwd: files.root })
      createCommit('update secrets.aes', {
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
