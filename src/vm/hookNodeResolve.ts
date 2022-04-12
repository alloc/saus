import kleur from 'kleur'
import { Module } from 'module'
import { relativeToCwd } from '../utils/relativeToCwd'
import { debug } from './debug'
import { getNodeModule } from './nodeModules'

export type NodeResolveHook = (
  id: string,
  importer: string,
  nodeResolve: (id: string, importer?: string) => string
) => string | null | undefined

export function hookNodeResolve(resolve: NodeResolveHook) {
  const nodeResolve: Function = (Module as any)._resolveFilename

  // @ts-ignore
  Module._resolveFilename = (
    id: string,
    parent: NodeModule,
    isMain: boolean,
    options: any
  ) => {
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

  return () => {
    // @ts-ignore
    Module._resolveFilename = nodeResolve
  }
}
