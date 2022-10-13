import { prompt } from '@utils/node/prompt'
import { green } from 'kleur/colors'
import { command } from '../../command'

command(removeSecrets) //
  .option('--all', `[boolean] remove all secrets at once`)

export { removeSecrets as rm }

async function removeSecrets(opts: { all?: boolean } = {}) {
  const { loadDeployContext, loadSecretSources, selectSource } = await import(
    '../../../secrets/api.js'
  )

  const context = await loadDeployContext({
    command: 'secrets',
  })

  await loadSecretSources(context)
  const sources = context.secrets.getMutableSources('unset')
  const source = await selectSource(sources)
  if (!source) {
    return
  }

  await context.secrets.load()

  let names: string[]
  if (opts.all) {
    names = Object.keys(context.secrets['_secrets'])
  } else {
    names =
      (
        await prompt({
          type: 'autocompleteMultiselect',
          name: 'names',
          message: 'Select which secrets to remove',
          choices: Object.keys(context.secrets['_secrets']).map(name => ({
            title: name,
          })),
        })
      ).names || []
  }

  if (!names.length) {
    return
  }

  console.log('')
  await source.unset(names)
  context.logger.info(green('✔︎ Secrets were saved!'))
}
