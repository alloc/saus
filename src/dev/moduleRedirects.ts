import { clientDir, runtimeDir } from '@/paths'
import { redirectModule } from '@/plugins/moduleRedirection'
import path from 'path'

export const clientRedirects = [
  redirectModule(
    path.join(runtimeDir, 'loadStateModule.ts'),
    path.join(clientDir, 'loadStateModule.ts')
  ),
  redirectModule(
    path.join(runtimeDir, 'stateListeners.ts'),
    path.join(clientDir, 'stateListeners.ts')
  ),
]
