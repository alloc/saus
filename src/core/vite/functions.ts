import {
  LoadResult,
  PartialResolvedId,
  ResolveIdResult,
  SourceDescription,
  TransformResult,
} from 'rollup'
import { Promisable } from 'type-fest'
import { compileModule } from '../../vm/compileModule'
import { SourceMap } from '../node/sourceMap'
import { vite } from '../vite'
import { Script } from '../vm/types'

export interface ViteFunctions {
  buildStart(): Promise<void>
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
  pluginContainer: vite.PluginContainer,
  options: {
    ssr?: boolean
    loadFallback?: (
      id: string
    ) => Promisable<SourceDescription | string | null | undefined>
  } = {}
): ViteFunctions {
  let self: ViteFunctions
  return (self = {
    buildStart() {
      return pluginContainer.buildStart({})
    },
    async resolveId(id, importer) {
      return coerceResolveIdResult(
        await pluginContainer.resolveId(id, importer!, options)
      )
    },
    async load(id) {
      let loadResult = await pluginContainer.load(id, options)
      if (!loadResult && options.loadFallback) {
        try {
          loadResult = await options.loadFallback(id)
        } catch {}
      }
      return coerceLoadResult(loadResult)
    },
    transform(code, id, inMap) {
      return pluginContainer.transform(code, id, { ...options, inMap })
    },
    fetchModule(id) {
      return compileModule(id, self)
    },
  })
}

export const coerceResolveIdResult = (resolved: ResolveIdResult) =>
  typeof resolved == 'string' ? { id: resolved } : resolved || null

export const coerceLoadResult = (loaded: LoadResult) =>
  typeof loaded == 'string' ? { code: loaded } : loaded || null
