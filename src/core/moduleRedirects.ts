import { clientDir, runtimeDir } from '@/paths'
import { redirectModule } from '@/plugins/moduleRedirection'
import fs from 'fs'
import path from 'path'

const stateModulesImpl = fs
  .readdirSync(path.join(runtimeDir, 'stateModules'))
  .filter(file => file.endsWith('.ts'))

export const clientRedirects = stateModulesImpl.map(file =>
  redirectModule(
    path.join(runtimeDir, 'stateModules', file),
    path.join(clientDir, 'stateModules', file)
  )
)
