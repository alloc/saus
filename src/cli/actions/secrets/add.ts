import { gray, green, yellow } from 'kleur/colors'
import { askForSecrets } from '../../../secrets/prompt'
import { command } from '../../command'

command(addSecrets) //

export { addSecrets as add }

async function addSecrets() {
  const { loadDeployContext, loadSecretSources, selectSource } = await import(
    '../../../secrets/api.js'
  )

  const context = await loadDeployContext({
    command: 'secrets',
  })

  await loadSecretSources(context)

  const sources = context.secrets.getMutableSources('set')
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

  const secrets = await askForSecrets(missing)
  if (secrets) {
    console.log('')

    const source = await selectSource(sources)
    if (source) {
      await source.set(secrets)
      context.logger.info(green('✔︎ Secrets were saved!'))
    }
  }
}
