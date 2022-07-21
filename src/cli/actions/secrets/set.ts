import { green } from 'kleur/colors'
import { askForSecrets } from '../../../secrets/prompt'
import { command } from '../../command'

command(setSecrets) //
  .option('--all', `[boolean] set all secrets at once`)

export { setSecrets as set }

async function setSecrets(opts: { all?: boolean } = {}) {
  const { loadDeployContext, loadSecretSources, selectSource } = await import(
    '../../../secrets/api'
  )

  const context = await loadDeployContext({
    command: 'secrets',
  })

  await loadSecretSources(context)
  const sources = context.secrets.getMutableSources('set')
  const source = await selectSource(sources)
  if (!source) {
    return
  }

  let missing = await context.secrets.load()

  let names: string[]
  if (opts.all) {
    names = Object.keys(context.secrets['_secrets'])
  } else {
    const { prompt } = await import('@saus/deploy-utils')
    names =
      (
        await prompt({
          type: 'autocompleteMultiselect',
          name: 'names',
          message: 'Select which secrets to replace',
          choices: Object.keys(context.secrets['_secrets']).map(name => ({
            title: name,
            value: name,
          })),
        })
      ).names || []
  }

  if (names.length) {
    console.log('')
    await source.unset(names)

    missing ||= new Set()
    names.forEach(name => missing!.add(name))
  }
  if (missing) {
    const secrets = await askForSecrets(missing)
    if (secrets) {
      console.log('')

      await source.set(secrets)
      context.logger.info(green('✔︎ Secrets were saved!'))
    }
  }
}
