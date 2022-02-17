import path from 'path'
import type { PartialResolvedId } from 'rollup'
import type { vite } from '../core'

type Promisable<T> = T | Promise<T>

declare module 'vite' {
  export interface Plugin {
    /** Redirect an absolute module path to another. */
    redirectModule?(
      id: string,
      importer: string | undefined
    ): Promisable<string | null | undefined>
    /** Resolve a bare import to an absolute module path. */
    resolveBareImport?(
      id: string,
      importer: string | undefined
    ): Promisable<string | null | undefined>
  }
}

const bareImportRE = /^[\w@]/

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
            const resolvedId = await plugin.resolveBareImport(id, importer)
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
          const replacementId = await plugin.redirectModule(id, importer)
          if (replacementId != null) {
            return { id: replacementId, meta: resolved?.meta }
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
  replacementId: string
): vite.Plugin {
  return {
    name: 'overrideBareImport:' + targetId,
    resolveBareImport(id) {
      if (id === targetId) {
        return replacementId
      }
    },
  }
}
