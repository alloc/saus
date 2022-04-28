import callsites from 'callsites'
import { SourceMapConsumer } from 'source-map'
import { SourceMap } from './sourceMap'

const stackFrameRE =
  /^ {4}at (?:(.+?)\s+\()?(?:(?:async )?(.+?):(\d+)(?::(\d+))?)(\)|$)/

export type StackTrace = {
  header: string
  frames: StackFrame[]
}

export type StackFrame = {
  text: string
  file: string
  line: number
  column: number
}

export function getStackFrame(depth: number): StackFrame | undefined {
  const callStack = callsites().filter(callsite => {
    const fileName = callsite.getFileName()
    return !!fileName && !fileName.startsWith('node:')
  })
  const callsite = callStack[depth]
  if (!callsite) {
    return
  }
  const file = callsite.getFileName()
  if (!file) {
    return
  }
  const func = callsite.getFunctionName()
  const line = callsite.getLineNumber() || 1
  const column = callsite.getColumnNumber() || 1

  let source = file + (line ? ':' + line : '') + (column ? ':' + column : '')
  if (func) {
    source = `${func} (${source})`
  }

  return {
    text: `    at ${source}`,
    file,
    line,
    column,
  }
}

export function parseStackTrace(stack: string): StackTrace {
  const header: string[] = []
  const frames: StackFrame[] = []
  for (const text of stack.split('\n')) {
    const match = stackFrameRE.exec(text)
    if (match) {
      frames.push({
        text,
        file: match[2],
        line: Number(match[3]),
        column: match[4] ? Number(match[4]) - 1 : 0,
      })
    } else if (!frames.length) {
      header.push(text)
    }
  }
  return {
    header: header.join('\n'),
    frames,
  }
}

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

export function resolveStackTrace(
  stack: string,
  getSourceMap: (file: string) => SourceMap | null
) {
  const parsed = parseStackTrace(stack)
  const lines = [parsed.header]
  for (const frame of parsed.frames) {
    const map = getSourceMap(frame.file)
    if (map) {
      traceStackFrame(frame, map)
    }
    lines.push(frame.text)
  }

  return lines.join('\n')
}
