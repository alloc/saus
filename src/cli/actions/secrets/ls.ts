import { gray } from 'kleur/colors'
import { command } from '../../command'

command(listSecrets) //

export { listSecrets as ls }

async function listSecrets() {
  const { loadDeployContext, loadSecretSources } = await import(
    '../../../secrets/api.js'
  )

  const context = await loadDeployContext({
    command: 'secrets',
  })

  await loadSecretSources(context)
  await context.secrets.load()

  const secrets = context.secrets['_secrets']
  if (Object.keys(secrets).length) {
    for (const [name, value] of Object.entries(secrets)) {
      console.log(name + ' = %O', value)
    }
  } else {
    process.stderr.write('\n\n' + gray('No secrets found.') + '\n')
  }
}
