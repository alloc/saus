import { resolve } from 'path'

export interface SourceMap {
  version: number
  file?: string
  sources: (string | null)[]
  sourcesContent?: string[]
  names: string[]
  mappings: string
}

export function toInlineSourceMap(map: SourceMap) {
  return (
    '\n//# ' +
    'sourceMappingURL=data:application/json;charset=utf-8;base64,' +
    Buffer.from(JSON.stringify(map), 'utf8').toString('base64')
  )
}

export function resolveMapSources(map: SourceMap, sourceRoot: string) {
  map.sources = map.sources.map(source =>
    source ? resolve(sourceRoot, source) : null
  )
}
