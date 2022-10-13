import { prompt } from '@utils/node/prompt'
import { bold } from 'kleur/colors'
import { SecretMap } from './types'

export async function askForSecrets(names: Iterable<string>) {
  const secrets: SecretMap = {}
  for (const name of names) {
    console.log(`\nWhat should ${bold(name)} be?`)
    let aborted = false
    const { secret } = await prompt(
      {
        name: 'secret',
        type: 'password',
        message: '',
      },
      {
        onCancel() {
          aborted = true
        },
      }
    )
    if (aborted) {
      break
    }
    if (secret) {
      secrets[name] = secret
    }
  }
  if (Object.keys(secrets).length) {
    return secrets
  }
}
