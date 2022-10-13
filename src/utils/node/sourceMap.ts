import * as convertSourceMap from 'convert-source-map'
import createDebug from 'debug'
import { dirname, resolve } from 'path'

const debug = createDebug('saus:sourcemap')

export interface SourceMap {
  version: number
  file?: string
  sources: string[]
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
  if (map.sources.length)
    map.sources = map.sources.map(source =>
      source ? resolve(sourceRoot, source) : null!
    )
}

export function loadSourceMap(code: string, file: string) {
  let converter = convertSourceMap.fromSource(code)
  try {
    converter ||= convertSourceMap.fromMapFileSource(code, dirname(file))
  } catch (e) {
    debug(`Source map for "${file}" could not be loaded.`)
  }
  return converter?.toObject() as SourceMap | undefined
}

const sourceMappingUrlRE = new RegExp('\\n//# sourceMappingURL=\\S+', 'g')

export function removeSourceMapUrls(code: string) {
  return code.replace(sourceMappingUrlRE, '')
}
