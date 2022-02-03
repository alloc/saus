import { codeFrameColumns, SourceLocation } from '@babel/code-frame'
import fs from 'fs'
import {
  parseStackTrace,
  StackFrame,
  traceStackFrame,
} from '../utils/resolveStackTrace'
import { ModuleMap } from './types'

const ignoredFrameRE = /(^node:|\/saus\/(?!examples))/
const kFormattedStack = Symbol.for('saus:formattedStack')

export function formatAsyncStack(
  error: any,
  moduleMap: ModuleMap,
  asyncStack: (StackFrame | undefined)[],
  filterStack?: (file: string) => boolean
) {
  if (!error || error[kFormattedStack]) {
    return
  }

  Object.defineProperty(error, kFormattedStack, {
    value: true,
  })

  const stack = parseStackTrace(error.stack)
  const ignoredFrameIndex = stack.frames.findIndex(frame =>
    ignoredFrameRE.test(frame.file)
  )

  let relevantFrames = stack.frames
    .slice(0, ignoredFrameIndex)
    .concat(asyncStack.filter(Boolean) as StackFrame[])

  if (filterStack) {
    relevantFrames = relevantFrames.filter(frame => filterStack(frame.file))
  }

  relevantFrames = relevantFrames.slice(0, 10)
  if (!relevantFrames.length) {
    return
  }

  // Remove the require stack added by Node.
  stack.header = stack.header.replace(/\nRequire stack:\n.+$/, '')

  let file: string | undefined
  let location: SourceLocation | undefined
  if (error instanceof SyntaxError) {
    const match = /^(\/[^\n:]+):(\d+)/.exec(stack.header)
    if (match) {
      file = match[1]
      location = {
        start: { line: Number(match[2]) },
      }
    }
  } else {
    const frame = relevantFrames[0]
    file = frame.file
    location = {
      start: frame,
    }
  }

  if (file && location) {
    try {
      const code = moduleMap[file]?.code ?? fs.readFileSync(file, 'utf8')
      stack.header = codeFrameColumns(code, location, {
        highlightCode: true,
        message: stack.header,
      })
    } catch {}
  }

  error.stack =
    stack.header +
    '\n' +
    relevantFrames
      .map(frame => {
        const module = moduleMap[frame.file]
        if (module?.map) {
          traceStackFrame(frame, module.map)
        }
        return frame.text.replace(/ __compiledModule \((.+?)\)/, ' $1')
      })
      .join('\n')
}

export function traceDynamicImport(error: any, skip = 0) {
  const stack = parseStackTrace(error.stack)
  if (skip) {
    stack.frames.splice(0, skip)
  }
  const ignoredFrameIndex = stack.frames.findIndex(frame =>
    ignoredFrameRE.test(frame.file)
  )
  return stack.frames.slice(0, ignoredFrameIndex)
}