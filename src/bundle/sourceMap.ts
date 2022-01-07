import { RawSourceMap as SourceMap } from 'source-map'

export type { SourceMap }

export function toInlineSourceMap(map: SourceMap) {
  return (
    '\n//# ' +
    'sourceMappingURL=data:application/json;charset=utf-8;base64,' +
    Buffer.from(JSON.stringify(map), 'utf8').toString('base64')
  )
}
