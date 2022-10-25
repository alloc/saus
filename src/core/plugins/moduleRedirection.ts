import { sausRootDir } from '@/paths'
import { bareImportRE } from '@utils/importRegex'
import createDebug from 'debug'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { PartialResolvedId } from 'rollup'
import type { vite } from '../core'

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

const debug = createDebug('saus:resolved')
const isDebug = !!process.env.DEBUG

/**
 * This plugin must be added for `redirectModule` and `overrideBareImport`
 * plugins to work as expected.
 */
export function moduleRedirection(
  inlinePlugins: vite.Plugin[] = [],
  {
    forbid: forbiddenModules = [],
    ssr: ssrMode,
  }: {
    forbid?: string[]
    ssr?: boolean
  } = {}
): vite.Plugin {
  if (isDebug && forbiddenModules.length) {
    forbiddenModules.forEach((id, i) => {
      if (id[0] == '.') {
        forbiddenModules[i] = fs.realpathSync(path.resolve(sausRootDir, id))
      }
    })
  }

  const resolvedCache = isDebug ? new Set<string>() : null
  const onResolved = (
    resolvedId: string,
    id: string,
    importer?: string | null
  ) => {
    if (isDebug && forbiddenModules.some(m => m == resolvedId || m == id))
      throw Error(
        `Forbidden module "${resolvedId}" was imported${
          id !== resolvedId ? ` as "${id}"` : ``
        } by "${importer}"`
      )

    if (resolvedCache && !resolvedCache.has(resolvedId)) {
      resolvedCache.add(resolvedId)
      debug(resolvedId.replace(os.homedir(), '~'))
    }
  }

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
    async resolveId(id, importer, opts) {
      if (ssrMode != null && ssrMode !== Boolean(opts.ssr)) {
        return // Only ssr or non-ssr modules are redirected.
      }

      if (bareImportRE.test(id))
        for (const plugin of plugins) {
          if (plugin.resolveBareImport) {
            let resolved = await plugin.resolveBareImport.call(
              this,
              id,
              importer
            )
            if (resolved != null) {
              if (typeof resolved == 'string') {
                resolved = { id: resolved }
              }
              onResolved(resolved.id, id, importer)
              return resolved
            }
          }
        }

      let absoluteId: string
      let resolved: PartialResolvedId | null = null
      if (path.isAbsolute(id) && !id.startsWith('/@')) {
        absoluteId = id
      } else {
        resolved = await this.resolve(id, importer, { skipSelf: true })
        if (!resolved || !path.isAbsolute(resolved.id)) {
          return resolved
        }
        absoluteId = resolved.id
      }
      for (const plugin of plugins) {
        if (plugin.redirectModule) {
          let replaced = await plugin.redirectModule.call(
            this,
            absoluteId,
            importer
          )
          if (replaced != null) {
            if (typeof replaced == 'string') {
              replaced = { id: replaced }
            }
            onResolved(replaced.id, id, importer)
            return { meta: resolved?.meta, ...replaced }
          }
        }
      }
      if (isDebug && fs.existsSync(absoluteId)) {
        onResolved(absoluteId, id, importer)
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
