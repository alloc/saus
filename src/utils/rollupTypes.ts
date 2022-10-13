type PartialNull<T> = {
  [P in keyof T]: T[P] | null
}

interface ModuleOptions {
  meta: Record<string, any>
  moduleSideEffects: boolean | 'no-treeshake'
  syntheticNamedExports: boolean | string
}

export interface PartialResolvedId extends Partial<PartialNull<ModuleOptions>> {
  external?: boolean | 'absolute' | 'relative'
  id: string
}

export interface SourceDescription extends Partial<PartialNull<ModuleOptions>> {
  ast?: unknown /* AcornNode */
  code: string
  map?: unknown /* SourceMapInput */
}

export type TransformResult = string | null | void | Partial<SourceDescription>

export type ResolveIdHook = (
  id: string,
  importer?: string | null
) => Promise<PartialResolvedId | null | undefined>
