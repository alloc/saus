import esModuleLexer from 'es-module-lexer'
import fs from 'fs'
import { Module } from 'module'
import { dirname } from 'path'
import { findPackage } from '../utils/findPackage'
import { plural } from '../utils/plural'
import { createAsyncRequire } from '../vm/asyncRequire'
import { ConfigHookRef, setConfigHooks } from './config'
import { debug } from './debug'
import { ResolvedConfig } from './vite'

export async function loadConfigHooks(config: ResolvedConfig) {
  const time = Date.now()

  const importer = config.saus.render
  const code = fs
    .readFileSync(importer, 'utf8')
    .split('\n')
    .filter(line => line.startsWith('import '))
    .join('\n')

  await esModuleLexer.init
  const [imports] = esModuleLexer.parse(code, importer)

  const configHooks: ConfigHookRef[] = []
  setConfigHooks(configHooks)

  const {
    resolve,
    cache: { ...oldCache },
  } = Module.createRequire(importer)

  const bareImportRE = /^[\w@]/
  const nodeResolve = (id: string, importer: string) => {
    if (!bareImportRE.test(id)) {
      return
    }
    const isMatch = (name: string) => {
      return id === name || id.startsWith(name + '/')
    }
    if (!config.resolve?.dedupe?.some(isMatch)) {
      const pkgPath = findPackage(dirname(importer))
      if (!pkgPath || dirname(pkgPath) === config.root) {
        return
      }
      // Ensure peer dependencies are deduped if possible.
      const { peerDependencies } = require(pkgPath)
      if (!Object.keys(peerDependencies || {}).some(isMatch)) {
        return
      }
    }
    try {
      return resolve(id, { paths: [config.root] })
    } catch {}
  }

  const reloadList = new Set<string>()
  const skippedInternals = /\/saus\/(?!examples|packages)/

  const requireAsync = createAsyncRequire({
    nodeResolve,
    shouldReload(id) {
      // Module was possibly cached by this `loadConfigHooks` call.
      if (!oldCache[id]) {
        return false
      }
      // Module was already reloaded by this `loadConfigHooks` call.
      if (reloadList.has(id)) {
        return false
      }
      // Internal modules should never be reloaded.
      if (skippedInternals.test(id)) {
        return false
      }
      reloadList.add(id)
      return true
    },
  })

  const relativePathRE = /^(?:\.\/|(\.\.\/)+)/
  for (const imp of imports) {
    const id = imp.n
    if (!id || relativePathRE.test(id) || imp.d !== -1) {
      continue
    }
    try {
      const resolvedId = nodeResolve(id, importer) || resolve(id)
      if (!/\.c?js$/.test(resolvedId || '')) {
        continue
      }
      await requireAsync(resolvedId, importer, false)
    } catch (e: any) {
      if (!/Cannot (use import|find module)/.test(e.message)) {
        console.error(e)
      }
    }
  }

  if (reloadList.size) {
    debug(`Reloaded %s modules`, reloadList.size)
  }

  debug(
    `Loaded %s in %sms`,
    plural(configHooks.length, 'config hook'),
    Date.now() - time
  )

  setConfigHooks(null)
  return configHooks
}
