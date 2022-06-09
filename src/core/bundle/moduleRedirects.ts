import path from 'path'
import {
  overrideBareImport,
  redirectModule,
} from '../../plugins/moduleRedirection'
import { bundleDir, clientDir, coreDir, httpDir, runtimeDir } from '../paths'

const emptyModule = path.join(runtimeDir, 'emptyModule.ts')

export const internalRedirects = [
  redirectModule(
    path.join(clientDir, 'node/loadPageModule.ts'),
    path.join(bundleDir, 'loadPageModule.ts')
  ),
  redirectModule(
    path.join(coreDir, 'constants.ts'),
    path.join(bundleDir, 'core/constants.ts')
  ),
  redirectModule(
    path.join(coreDir, 'getCurrentModule.ts'),
    path.join(bundleDir, 'ssrModules.ts')
  ),
]

export const ssrRedirects = [
  overrideBareImport('saus', path.join(bundleDir, 'index.ts')),
  overrideBareImport('saus/client', path.join(clientDir, 'index.ssr.ts')),
  overrideBareImport('saus/core', path.join(bundleDir, 'core/index.ts')),
  overrideBareImport('saus/http', path.join(httpDir, 'index.ts')),
]

export const clientRedirects = [
  overrideBareImport('debug', path.join(bundleDir, 'debug.ts')),
  overrideBareImport('saus', emptyModule),
  overrideBareImport('saus/core', emptyModule),
  overrideBareImport('saus/http', path.join(httpDir, 'index.ts')),
  redirectModule(
    path.join(clientDir, 'index.dev.ts'),
    path.join(clientDir, 'index.prod.ts')
  ),
  redirectModule(
    path.join(coreDir, 'buffer.ts'),
    path.join(clientDir, 'buffer.ts')
  ),
  redirectModule(
    path.join(httpDir, 'get.ts'),
    path.join(clientDir, 'http/get.ts')
  ),
  redirectModule(path.join(httpDir, 'httpImport.ts'), emptyModule),
  redirectModule(
    path.join(runtimeDir, 'loadStateModule.ts'),
    path.join(clientDir, 'loadStateModule.ts')
  ),
]
