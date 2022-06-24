import { defer } from '@/utils/defer'
import { noop } from '@/utils/noop'
import { prompt } from '@saus/deploy-utils'
import { green } from 'kleur/colors'
import { success } from 'misty'
import { loadDeployContext } from '../deploy/context'
import { loadDeployFile } from '../deploy/loader'
import { MutableSecretSource, SecretMap } from './types'

export async function addSecrets() {
  const context = await loadDeployContext({
    command: 'secrets',
  })

  const { logger } = context

  // Use the `addTarget` function to detect when to
  // start loading from our secret sources.
  const loading = defer<void>()
  context.addDeployTarget = () => loading.resolve()
  context.addDeployAction = () => {
    loading.resolve()
    return new Promise(noop)
  }

  loadDeployFile(context)
  await loading

  logger.isLogged('info') && success('Deployment file loaded!')

  const sources = context.secrets.getMutableSources()
  if (!sources.length) {
    throw Error('[saus] None of your deploy plugins allow adding secrets.')
  }

  const missing = await context.secrets.load()
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
