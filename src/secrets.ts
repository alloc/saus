import { prompt } from '@saus/deploy-utils'
import { green } from 'kleur/colors'
import { success } from 'misty'
import { loadBundleContext } from './core/bundle'
import { MutableSecretSource, SecretMap } from './core/deploy'
import { prepareDeployContext } from './core/deploy/context'
import { loadDeployFile } from './core/loadDeployFile'

export async function addSecrets() {
  const context = await prepareDeployContext(
    { command: 'secrets' },
    loadBundleContext()
  )

  await loadDeployFile(context)

  const { logger } = context
  logger.isLogged('info') && success('Plugins loaded!')

  const sources = context.secretHub.getMutableSources()
  if (!sources.length) {
    throw Error('[saus] None of your deploy plugins allow adding secrets.')
  }

  const missing = await context.secretHub.load()
  if (!missing) {
    throw Error('[saus] Every expected secret is already set.')
  }

  const secrets: SecretMap = {}
  for (const name of missing) {
    logger.clearScreen('info')

    const { secret } = await prompt({
      name: 'secret',
      type: 'password',
      message: 'The name is',
    })
    if (!secret) {
      break
    }
    secrets[name] = secret
  }

  if (!Object.keys(secrets).length) {
    return
  }

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

  context.logger.info(green('✔︎ Secrets were saved!'), { clear: true })
}
