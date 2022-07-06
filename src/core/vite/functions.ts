import {
  LoadResult,
  PartialResolvedId,
  ResolveIdResult,
  SourceDescription,
  TransformResult,
} from 'rollup'
import { SourceMap } from '../node/sourceMap'
import { vite } from '../vite'
import { Script } from '../vm/types'
import { compileModule } from './compileModule'

export interface ViteFunctions {
  resolveId: (
    id: string,
    importer?: string | null
  ) => Promise<PartialResolvedId | null | undefined>
  load: (id: string) => Promise<SourceDescription | null | undefined>
  transform: (
    code: string,
    id: string,
    inMap?: SourceMap
  ) => Promise<TransformResult>
  /**
   * Load and transform a module with Vite plugins.
   */
  fetchModule: (id: string) => Promise<Script>
}

export function getViteFunctions(
  pluginContainer: vite.PluginContainer
): ViteFunctions {
  return {
    async resolveId(id, importer) {
      return coerceResolveIdResult(
        await pluginContainer.resolveId(id, importer!, { ssr: true })
      )
    },
    async load(id) {
      return coerceLoadResult(await pluginContainer.load(id, { ssr: true }))
    },
    transform(code, id, inMap) {
      return pluginContainer.transform(code, id, { inMap, ssr: true })
    },
    fetchModule(id) {
      return compileModule(id, this)
    },
  }
}

export const coerceResolveIdResult = (resolved: ResolveIdResult) =>
  typeof resolved == 'string' ? { id: resolved } : resolved || null

export const coerceLoadResult = (loaded: LoadResult) =>
  typeof loaded == 'string' ? { code: loaded } : loaded || null
