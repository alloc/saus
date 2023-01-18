import { SourceMapConsumer } from 'source-map'
import { resolve } from 'path'
import { StackFrame } from '../../parseStackTrace'
import { SourceMap } from '../sourceMap'

const consumers = new WeakMap<SourceMap, SourceMapConsumer>()

export function traceStackFrame(frame: StackFrame, map: SourceMap) {
  let consumer = consumers.get(map)
  if (!consumer) {
    consumer = new SourceMapConsumer(map as any)
    consumers.set(map, consumer)
  }
  let traced = consumer.originalPositionFor(frame)
  if (!traced.source) {
    traced = {
      source: (consumer as any).sources[0],
      line: frame.line,
      column: 0,
    }
  }
  if (traced.source) {
    const sourcePath = resolve(frame.file, '..', traced.source)
    frame.line = traced.line
    frame.column = traced.column + 1
    frame.text = frame.text
      .replace(frame.file, sourcePath)
      .replace(/:\d+(:\d+)?/, ':' + frame.line + ':' + frame.column)
    frame.file = sourcePath
  }
  return frame
}
