import { SourceMap } from '../utils/sourceMap'
import type { ImporterSet } from './ImporterSet'

export type Script = { code: string; map?: SourceMap }

/** This property exists on linked Node.js module instances */
export const kLinkedModule = Symbol.for('saus.LinkedModule')

/**
 * A Node.js-compatible module that's been linked into the
 * `node_modules` of the project.
 */
export interface LinkedModule {
  id: string
  importers: Set<string>
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
}

export type ModuleMap = Record<string, CompiledModule> & {
  __compileQueue?: Promise<void>
}

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
) => Promisable<string | undefined>

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
