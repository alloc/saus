import { SourceMapConsumer } from 'source-map'
import { SourceMap } from '../sourceMap'
import { StackFrame } from './types'

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
    frame.line = traced.line
    frame.column = traced.column + 1
    frame.text = frame.text
      .replace(frame.file, (frame.file = traced.source))
      .replace(/:\d+(:\d+)?/, ':' + frame.line + ':' + frame.column)
  }
  return frame
}
