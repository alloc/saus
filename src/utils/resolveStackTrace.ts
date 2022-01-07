import { SourceMap } from '../bundle/sourceMap'
import { SourceMapConsumer } from 'source-map'

const stackFrameRE = /^ {4}at (?:(.+?)\s+\()?(?:(.+?):(\d+)(?::(\d+))?)\)?/

export function resolveStackTrace(stack: string, code: string, map: SourceMap) {
  const newStack: string[] = []
  const consumer = new SourceMapConsumer(map)

  for (const line of stack.split('\n')) {
    const match = stackFrameRE.exec(line)
    if (!match) {
      newStack.push(line)
      continue
    }

    const traced = consumer.originalPositionFor({
      line: Number(match[3]),
      column: match[4] ? Number(match[4]) - 1 : 0,
    })

    if (!traced.source) {
      newStack.push(line)
      continue
    }

    newStack.push(
      line
        .replace(match[2], traced.source)
        .replace(/:\d+(:\d+)?/, ':' + traced.line + ':' + (traced.column + 1))
    )
  }

  return newStack.join('\n')
}
