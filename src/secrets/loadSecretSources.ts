import { defer } from '@utils/defer'
import { noop } from '@utils/noop'
import { green } from 'kleur/colors'
import { DeployContext } from '../deploy/context'
import { loadDeployFile } from '../deploy/loader'

export async function loadSecretSources(context: DeployContext) {
  // Use the `addTarget` function to detect when to
  // start loading from our secret sources.
  const loading = defer<void>()
  context.addDeployTarget = () => loading.resolve()
  context.addDeployAction = () => {
    loading.resolve()
    return new Promise(noop)
  }

  loadDeployFile(context)
  await loading.promise

  if (context.logger.isLogged('info')) {
    process.stderr.write(green('✔︎') + ' Plugin secrets were loaded.\n')
  }
}
