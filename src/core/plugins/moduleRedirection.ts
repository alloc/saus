import path from 'path'
import type { PartialResolvedId } from 'rollup'
import type { vite } from '../core'
import { bareImportRE } from '../utils/importRegex'

type Promisable<T> = T | Promise<T>

declare module 'vite' {
  export interface Plugin {
    /** Redirect an absolute module path to another. */
    redirectModule?(
      this: vite.RollupPluginContext,
      id: string,
      importer: string | undefined
    ): Promisable<string | PartialResolvedId | null | undefined>
    /** Resolve a bare import to an absolute module path. */
    resolveBareImport?(
      this: vite.RollupPluginContext,
      id: string,
      importer: string | undefined
    ): Promisable<string | PartialResolvedId | null | undefined>
  }
}

/**
 * This plugin must be added for `redirectModule` and `overrideBareImport`
 * plugins to work as expected.
 */
export function moduleRedirection(
  inlinePlugins: vite.Plugin[] = []
): vite.Plugin {
  let plugins: vite.Plugin[]
  return {
    name: 'moduleRedirection',
    enforce: 'pre',
    configResolved(config) {
      plugins = inlinePlugins.concat(
        config.plugins.filter(
          plugin => plugin.resolveBareImport || plugin.redirectModule
        )
      )
    },
    async resolveId(id, importer) {
      if (bareImportRE.test(id))
        for (const plugin of plugins) {
          if (plugin.resolveBareImport) {
            const resolvedId = await plugin.resolveBareImport.call(
              this,
              id,
              importer
            )
            if (resolvedId != null) {
              return resolvedId
            }
          }
        }

      let resolved: PartialResolvedId | null = null
      if (!path.isAbsolute(id)) {
        resolved = await this.resolve(id, importer, { skipSelf: true })
        if (!resolved) {
          return
        }
        if (!path.isAbsolute(resolved.id)) {
          return resolved
        }
        id = resolved.id
      }
      for (const plugin of plugins) {
        if (plugin.redirectModule) {
          let replaced = await plugin.redirectModule.call(this, id, importer)
          if (replaced != null) {
            if (typeof replaced == 'string') {
              replaced = { id: replaced }
            }
            return { meta: resolved?.meta, ...replaced }
          }
        }
      }
      return resolved
    },
  }
}

export function redirectModule(
  targetId: string,
  replacementId: string
): vite.Plugin {
  return {
    name: 'redirectModule:' + targetId,
    redirectModule(id) {
      if (id === targetId) {
        return replacementId
      }
    },
  }
}

export function overrideBareImport(
  targetId: string,
  replacementId: string,
  debug?: true | ((id: string) => boolean)
): vite.Plugin {
  return {
    name: 'overrideBareImport:' + targetId,
    resolveBareImport(id) {
      if (debug && (debug == true || debug(id))) {
        debugger
      }
      if (id === targetId) {
        return replacementId
      }
    },
  }
}
