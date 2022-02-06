import { SourceMap } from '../utils/sourceMap'
import type { ImporterSet } from './ImporterSet'

export type Script = { code: string; map?: SourceMap }

export interface CompiledModule extends Script {
  id: string
  env: Record<string, any>
  importers: ImporterSet
  exports?: Promise<any>
}

export type ModuleMap = Record<string, CompiledModule> & {
  __compileQueue?: Promise<void>
}

export type ImportMeta = Record<string, any>

type Promisable<T> = T | Promise<T>

export type ResolveIdHook = (
  id: string,
  importer: string,
  isDynamic: boolean
) => Promisable<string | undefined>

export type CompileModuleHook = (
  id: string,
  requireAsync: RequireAsync
) => Promise<CompiledModule | null>

export type RequireAsync = (
  id: string,
  importer: string,
  isDynamic: boolean
) => Promise<any>
