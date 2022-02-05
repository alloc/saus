import kleur from 'kleur'
import { Module } from 'module'
import { relativeToCwd } from '../utils/relativeToCwd'
import { debug } from './debug'

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
    const resolved = resolve(id, parent.id, (id, importer) =>
      nodeResolve(
        id,
        parent,
        isMain,
        importer ? { paths: [importer] } : options
      )
    )

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
