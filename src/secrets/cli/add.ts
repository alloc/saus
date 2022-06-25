import { prompt } from '@saus/deploy-utils'
import { bold, gray, green, yellow } from 'kleur/colors'
import { loadDeployContext } from '../../deploy/context'
import { loadSecretSources } from '../loadSecretSources'
import { MutableSecretSource, SecretMap } from '../types'

export async function addSecrets() {
  const context = await loadDeployContext({
    command: 'secrets',
  })

  await loadSecretSources(context)

  const sources = context.secrets.getMutableSources()
  if (!sources.length) {
    throw Error('[saus] None of your deploy plugins allow adding secrets.')
  }

  const missing = await context.secrets.load()
  if (!missing) {
    throw Error('[saus] Every expected secret is already set.')
  }

  const { logger } = context
  logger.clearScreen('info')
  logger.warn('')
  logger.warn(
    yellow('Secrets are missing:') +
      Array.from(missing, name => '\n  ' + name)
        .slice(0, 3)
        .join('') +
      (missing.size > 3 ? gray(`\n  +${missing.size - 3} more`) : '')
  )

  const secrets: SecretMap = {}
  for (const name of missing) {
    console.log(`\nWhat should ${bold(name)} be?`)
    const { secret } = await prompt({
      name: 'secret',
      type: 'password',
      message: '',
    })
    if (!secret) {
      break
    }
    secrets[name] = secret
  }

  if (!Object.keys(secrets).length) {
    return
  }

  console.log('')

  let source: MutableSecretSource
  if (sources.length > 1) {
    source = (
      await prompt({
        name: 'source',
        type: 'select',
        choices: sources.map(s => ({ title: s.name, value: s })),
      })
    ).source
  } else {
    source = sources[0]
  }

  await source.set(secrets)

  const commitMsg = 'add secrets\n' + Object.keys(secrets).join('\n')
  if (await context.files.commit(commitMsg)) {
    await context.files.push()
  }

  context.logger.info(green('✔︎ Secrets were saved!'))
}
