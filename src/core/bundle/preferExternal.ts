import builtinModules from 'builtin-modules'
import fs from 'fs'
import kleur from 'kleur'
import path from 'path'
import { findPackage } from '../../utils/findPackage'
import { SausContext } from '../context'
import { debug } from '../debug'
import { vite } from '../vite'

type ExternalDictation = { external: boolean; msg?: string }
type PreferExternal = vite.Plugin & {
  isExternal(id: string): ExternalDictation
}

export function preferExternal(context: SausContext): PreferExternal {
  const externalCache = new Map<string, boolean>()
  const cjsResolve = context.config.createResolver({
    asSrc: false,
    isRequire: true,
    mainFields: ['main'],
    extensions: ['.js', '.cjs'],
  })

  function isExternal(id: string): ExternalDictation {
    const isNodeModule = id.includes('/node_modules/')
    if (!isNodeModule && id.startsWith(context.root + '/')) {
      // Project files are resolved normally.
      return { external: false }
    }

    // Ensure the resolved path is a CommonJS module,
    // since the package might be ESM only.
    if (!/\.c?js$/.test(id)) {
      return { external: false }
    }

    let external = externalCache.get(id)
    if (external !== undefined) {
      return { external }
    }

    let result: ExternalDictation

    // Modules using ESM syntax must be bundled.
    const code = fs.readFileSync(id, 'utf8')
    if (/^(im|ex)port /m.test(code)) {
      result = { external: false, msg: 'is not commonjs' }
    } else {
      const pkgPath = findPackage(path.dirname(id))
      if (!pkgPath) {
        result = { external: false }
      } else {
        // Packages that depend on Saus must be bundled.
        const pkg = require(pkgPath)
        external = !(
          'saus' in (pkg.dependencies || {}) ||
          'saus' in (pkg.peerDependencies || {})
        )
        if (external) {
          result = { external: true, msg: 'is external' }
        } else {
          result = { external: false, msg: 'depends on saus' }
        }
      }
    }

    externalCache.set(id, result.external)
    return result
  }

  return {
    name: 'saus:preferExternal',
    enforce: 'pre',
    isExternal,
    async resolveId(id, importer) {
      if (importer && /^[\w@]/.test(id)) {
        if (builtinModules.includes(id)) {
          return { id, external: true }
        }
        const log = (color: typeof kleur.blue, resultMsg: string) => {
          debug(id + kleur.gray(` from ${importer}`))
          debug(`  ${color(resultMsg)}`)
        }
        let resolved: string | undefined
        try {
          resolved = await cjsResolve(id, importer, undefined, true)
        } catch (e) {
          log(kleur.red, (e as any).message)
          return null
        }
        if (!resolved) {
          log(kleur.red, 'not found')
          return null
        }
        const { external, msg } = isExternal(resolved)
        if (msg) {
          log(external ? kleur.green : kleur.yellow, msg)
        }
        return external ? { id: resolved, external: true } : null
      }
    },
  }
}
