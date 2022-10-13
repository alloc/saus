import { clientDir, runtimeDir } from '@/paths'
import { redirectModule } from '@/plugins/moduleRedirection'
import fs from 'fs'
import path from 'path'

const redirectedFiles = fs
  .readdirSync(path.join(runtimeDir, 'stateModules'))
  .filter(file => file.endsWith('.mjs'))
  .map(file => [
    path.join(runtimeDir, 'stateModules', file),
    path.join(clientDir, 'stateModules', file),
  ])
  .filter(mapping => fs.existsSync(mapping[1]))

export const clientRedirects = redirectedFiles.map(([sourceFile, targetFile]) =>
  redirectModule(sourceFile, targetFile)
)
