import { SourceMap } from '../utils/sourceMap'
import type { ImporterSet } from './ImporterSet'

export type Script = { code: string; map?: SourceMap }

/** This property exists on linked Node.js module instances */
export const kLinkedModule = Symbol.for('saus.LinkedModule')

export function isLinkedModule(
  module: CompiledModule | LinkedModule
): module is LinkedModule {
  return module[kLinkedModule] == true
}

/**
 * A Node.js-compatible module that's been linked into the
 * `node_modules` of the project.
 */
export interface LinkedModule {
  id: string
  imports: Set<LinkedModule>
  importers: Set<CompiledModule | LinkedModule>
  [kLinkedModule]: true
}

export interface CompiledModule extends Script {
  id: string
  env: Record<string, any>
  imports: Set<CompiledModule | LinkedModule>
  importers: ImporterSet
  exports?: Promise<any>
  /**
   * Compiled modules referenced by a relative import are included
   * in the same `package` as their importer.
   *
   * If undefined, this package never imported a module (or was imported
   * by another module) using a relative path.
   */
  package?: Set<CompiledModule>
  [kLinkedModule]?: undefined
}

export type ModuleMap = Record<string, CompiledModule | undefined> & {
  __compileQueue?: Promise<void>
}

export type LinkedModuleMap = Record<string, LinkedModule | undefined>

export type ImportMeta = Record<string, any>

/**
 * This hook filters the given `imported` array, removing any import bindings
 * that do not refer to a mutable variable. It can return `true` to indicate
 * all bindings are mutable, or `false` to indicate none of them are.
 */
export type ForceLazyBindingHook = (
  imported: string[],
  source: string,
  importer: string
) => string[] | boolean

type Promisable<T> = T | Promise<T>

export type ResolveIdHook = (
  id: string,
  importer?: string | null,
  isDynamic?: boolean
) => Promisable<ResolvedId | null | undefined>

export type ResolvedId = {
  id: string
  /**
   * Note that `"absolute"` and `"relative"` are (currently) treated the same as `true`,
   * which means the Node.js module loader will be used (except for HTTP modules).
   */
  external?: boolean | 'absolute' | 'relative'
  /**
   * Prevent `shouldReload` hook from being called for this module.
   */
  reload?: boolean
}

export type CompileModuleHook = (
  id: string,
  requireAsync: RequireAsync,
  virtualId?: string
) => Promise<CompiledModule | null>

export type RequireAsync = (
  id: string,
  importer?: string | null,
  isDynamic?: boolean
) => Promise<any>
