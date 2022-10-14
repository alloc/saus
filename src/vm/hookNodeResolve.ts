import kleur from 'kleur'
import { Module } from 'module'
import path from 'path'
import { relativeToCwd } from '../node/relativeToCwd'
import { debug } from './debug'
import { getNodeModule } from './nodeModules'

export type NodeResolveHook = (
  id: string,
  importer: string,
  nodeResolve: (id: string, importer?: string) => string
) => string | null | undefined

export function hookNodeResolve(resolve: NodeResolveHook) {
  const nodeResolve: Function = (Module as any)._resolveFilename
  const nodeLoader: Function = (Module as any)._load

  // Track which paths are returned by resolveHook while
  // inside the `Module._load` hook.
  const loadedPaths = new Set<string>()

  // Node.js maintains an internal resolution cache, so we
  // have to override `Module._load` to avoid it.
  const loadHook = (id: string, parent: NodeModule, isMain: boolean) => {
    const loadedPath = resolveHook(id, parent, isMain)
    loadedPaths.add(loadedPath)

    return nodeLoader(loadedPath, parent, isMain)
  }

  // Our resolution logic still needs to live in `Module._resolveFilename`
  // or else it won't be used when `require.resolve` is called.
  const resolveHook = (
    id: string,
    parent: NodeModule,
    isMain: boolean,
    options?: any
  ): string => {
    if (path.isAbsolute(id) && loadedPaths.has(id)) {
      return id // Already resolved.
    }

    const resolved =
      !(options && options.skipSelf) &&
      resolve(id, parent.id, (id, importer) => {
        // In the case of an explicit importer, we cannot use the
        // `paths` option of Module._resolveFilename, since it doesn't
        // support relative paths. Instead, we have to use the Module
        // instance of the importer.
        if (importer && importer !== parent.id) {
          const importerModule = getNodeModule(importer)
          return (
            importerModule
              ? importerModule.require
              : Module.createRequire(importer)
          ).resolve(id)
        }
        return nodeResolve(id, parent, isMain, options)
      })

    process.env.DEBUG &&
      resolved &&
      resolved !== nodeResolve(id, parent, isMain, options) &&
      debug(
        `Forced %s to resolve as %s`,
        kleur.gray(relativeToCwd(parent.id + ':')) + kleur.yellow(id),
        kleur.green(relativeToCwd(resolved))
      )

    return resolved || nodeResolve(id, parent, isMain, options)
  }

  // @ts-ignore
  Module._resolveFilename = resolveHook
  // @ts-ignore
  Module._load = loadHook

  return () => {
    // @ts-ignore
    Module._resolveFilename = nodeResolve
    // @ts-ignore
    Module._load = nodeLoader
  }
}
