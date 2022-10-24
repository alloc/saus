import {
  clientDir,
  emptyModulePath,
  httpDir,
  runtimeDir,
  utilsDir,
} from '@/paths'
import { overrideBareImport, redirectModule } from '@/plugins/moduleRedirection'
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

export const clientRedirects = [
  ...redirectedFiles.map(([sourceFile, targetFile]) =>
    redirectModule(sourceFile, targetFile)
  ),
  redirectModule(
    path.join(utilsDir, 'node/buffer.mjs'),
    path.join(clientDir, 'buffer.mjs')
  ),
  redirectModule(
    path.join(utilsDir, 'node/textDecoder.mjs'),
    path.join(clientDir, 'textDecoder.mjs')
  ),
  redirectModule(
    path.join(httpDir, 'get.mjs'),
    path.join(clientDir, 'http/get.mjs')
  ),
  overrideBareImport('saus', emptyModulePath),
  overrideBareImport('saus/core', emptyModulePath),
  redirectModule(path.join(httpDir, 'httpImport.mjs'), emptyModulePath),
]
