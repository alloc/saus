import esModuleLexer from 'es-module-lexer'
import fs from 'fs'
import { Module } from 'module'
import { dirname } from 'path'
import { ConfigHookRef, setConfigHooks } from './configHooks'
import { debug } from './debug'
import { findPackage } from './node/findPackage'
import { bareImportRE, relativePathRE } from './utils/importRegex'
import { plural } from './utils/plural'
import { ResolvedConfig } from './vite'
import { createAsyncRequire } from './vm/asyncRequire'
import { createFullReload } from './vm/fullReload'

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

  const { resolve } = Module.createRequire(importer)
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
      return resolve(id, {
        paths: [config.root],
        // @ts-ignore: Avoid infinite recursion.
        skipSelf: true,
      })
    } catch {}
  }

  const reloadList = new Set<string>()
  const requireAsync = createAsyncRequire({
    nodeResolve,
    shouldReload: createFullReload(reloadList),
  })

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
