import { LoadResult, ResolveIdResult, TransformResult } from 'rollup'
import { Promisable } from 'type-fest'
import { SourceMap } from '../node/sourceMap'
import { vite } from '../vite'

export interface ViteFunctions {
  resolveId: (
    id: string,
    importer?: string | null
  ) => Promisable<ResolveIdResult>
  load: (id: string) => Promisable<LoadResult>
  transform: (
    code: string,
    id: string,
    inMap?: SourceMap
  ) => Promisable<TransformResult>
}

export function getViteFunctions(
  pluginContainer: vite.PluginContainer
): ViteFunctions {
  return {
    resolveId: (id, importer) =>
      pluginContainer.resolveId(id, importer!, { ssr: true }),
    load: id => pluginContainer.load(id, { ssr: true }),
    transform: (code, id, inMap) =>
      pluginContainer.transform(code, id, { inMap, ssr: true }),
  }
}
