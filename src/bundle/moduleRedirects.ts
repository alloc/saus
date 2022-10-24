import * as coreRedirects from '@/moduleRedirects'
import {
  bundleDir,
  clientDir,
  coreDir,
  httpDir,
  runtimeDir,
  secretsDir,
  utilsDir,
} from '@/paths'
import { overrideBareImport, redirectModule } from '@/plugins/moduleRedirection'
import path from 'path'

// Used when pre-bundling the Saus runtime.
export const internalRedirects = [
  redirectModule(
    path.join(clientDir, 'node/pageClient.mjs'),
    path.join(bundleDir, 'client/pageClient.mjs')
  ),
  redirectModule(
    path.join(coreDir, 'constants.mjs'),
    path.join(bundleDir, 'core/constants.mjs')
  ),
  redirectModule(
    path.join(utilsDir, 'node/currentModule.mjs'),
    path.join(runtimeDir, 'ssrModules.mjs')
  ),
  redirectModule(
    path.join(secretsDir, 'defineSecrets.mjs'),
    path.join(bundleDir, 'defineSecrets.mjs')
  ),
]

// Only applied to client modules.
export const clientRedirects = [
  overrideBareImport('debug', path.join(bundleDir, 'bundle/debug.mjs')),
  redirectModule(
    path.join(clientDir, 'index.dev.mjs'),
    path.join(clientDir, 'index.prod.mjs')
  ),
  ...coreRedirects.clientRedirects,
]

// Only applied when generating a server bundle.
export const ssrBundleRedirects = [
  overrideBareImport('saus', path.join(bundleDir, 'api.mjs')),
  overrideBareImport('saus/client', path.join(bundleDir, 'client/api.mjs')),
  overrideBareImport('saus/core', path.join(bundleDir, 'core/api.mjs')),
  overrideBareImport('saus/http', path.join(httpDir, 'index.mjs')),
  redirectModule(
    path.join(clientDir, 'pageClient.mjs'),
    path.join(bundleDir, 'client/pageClient.mjs')
  ),
]
