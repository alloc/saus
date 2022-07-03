import esModuleLexer from 'es-module-lexer'
import { Module } from 'module'
import { dirname } from 'path'
import { ConfigHookRef, setConfigHooks } from './configHooks'
import { debug } from './debug'
import { findPackage } from './node/findPackage'
import { SausContext } from './types'
import { bareImportRE, relativePathRE } from './utils/importRegex'
import { plural } from './utils/plural'
import { createAsyncRequire } from './vm/asyncRequire'
import { createFullReload } from './vm/fullReload'

export async function loadConfigHooks(
  context: SausContext
): Promise<ConfigHookRef[]> {
  const time = Date.now()

  const configHooks: ConfigHookRef[] = []
  setConfigHooks(configHooks)

  const { config } = context
  const { resolve } = Module.createRequire(config.root)

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

  const importers = await Promise.all(
    [...context.layoutEntries, context.defaultLayoutId].map(async url => {
      const resolved = await context.resolveId(url)
      if (!resolved) {
        throw Error(`Failed to resolve "${url}"`)
      }
      return resolved.id
    })
  )

  await esModuleLexer.init
  for (const importer of importers) {
    let { code } = (await context.fetchModule(importer))!

    code = code
      .split('\n')
      .filter(line => line.startsWith('import '))
      .join('\n')

    const [imports] = esModuleLexer.parse(code, importer)
    for (const imp of imports) {
      const id = imp.n
      if (!id || relativePathRE.test(id) || imp.d !== -1) {
        continue
      }
      try {
        const resolvedId =
          nodeResolve(id, importer) || resolve(id, { paths: [importer] })

        if (/\.c?js$/.test(resolvedId || '')) {
          await requireAsync(resolvedId, importer, false)
        }
      } catch (e: any) {
        if (!/Cannot (use import|find module)/.test(e.message)) {
          console.error(e)
        }
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
