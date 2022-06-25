import { gray } from 'kleur/colors'
import { loadDeployContext } from '../../deploy/context'
import { loadSecretSources } from '../loadSecretSources'

export async function listSecrets() {
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
