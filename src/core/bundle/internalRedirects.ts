import path from 'path'
import { redirectModule } from '../../plugins/moduleRedirection'
import { bundleDir, clientDir, coreDir } from '../paths'

export const internalRedirects = [
  redirectModule(
    path.join(coreDir, 'constants.ts'),
    path.join(bundleDir, 'core/constants.ts')
  ),
  redirectModule(
    path.join(clientDir, 'node/loadPageModule.ts'),
    path.join(bundleDir, 'loadPageModule.ts')
  ),
  redirectModule(
    path.join(coreDir, 'getCurrentModule.ts'),
    path.join(bundleDir, 'ssrModules.ts')
  ),
]
