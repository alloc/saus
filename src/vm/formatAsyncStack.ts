import { codeFrameColumns, SourceLocation } from '@babel/code-frame'
import { removeSourceMapUrls } from '@utils/node/sourceMap'
import { parseStackTrace, StackFrame, traceStackFrame } from '@utils/node/stack'
import createDebug from 'debug'
import fs from 'fs'
import { ModuleMap } from './moduleMap'

const kFormattedStack = Symbol.for('saus:formattedStack')
const debugStack = createDebug('saus:stack')
const sausFileRE = /\/saus\/(?!examples|packages)/
const nodeBuiltinRE = /^node:/

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

  let relevantFrames =
    error.code == 'MODULE_NOT_FOUND'
      ? []
      : stack.frames.slice(error.framesToPop || 0)

  if (!process.env.DEBUG)
    relevantFrames = relevantFrames.filter(
      frame => !nodeBuiltinRE.test(frame.file)
    )

  if (!debugStack.enabled)
    relevantFrames = relevantFrames.filter(
      frame => !sausFileRE.test(frame.file)
    )

  // Async frames are omitted if their file/line pair exists
  // already in the synchronous stack trace.
  const syncFrameIds = new Set<string>()

  for (const frame of relevantFrames) {
    const module = moduleMap.get(frame.file)
    if (module?.map) {
      traceStackFrame(frame, module.map)
    }
    syncFrameIds.add(frame.file + ':' + frame.line)
  }

  for (const frame of asyncStack) {
    if (!frame) continue
    const module = moduleMap.get(frame.file)
    if (module?.map) {
      traceStackFrame(frame, module.map)
    }
    if (!syncFrameIds.has(frame.file + ':' + frame.line)) {
      relevantFrames.push(frame)
    }
  }

  if (!process.env.DEBUG) {
    // Allow user-defined stack filtering.
    if (filterStack) {
      relevantFrames = relevantFrames.filter(frame => filterStack(frame.file))
    }
    // Shorten the stack trace.
    relevantFrames = relevantFrames.slice(0, 10)
  }

  // If no relevant frames exist after filtering, or the only remaining
  // frames are related to Vite internals, abort the stack rewrite.
  if (relevantFrames.every(isViteInternal)) {
    return
  }

  // Remove the require stack added by Node.
  stack.header = stack.header.replace(/\nRequire stack:\n.+$/, '')

  const omittedScopeRE = /async __compiledModule \((.+?)\)/
  const tracedFrames = relevantFrames
    .map(frame => frame.text.replace(omittedScopeRE, ' $1'))
    .join('\n')

  // Append a code snippet to the error message, but only if
  // the first frame is unrelated to Vite internals.
  if (!isViteInternal(relevantFrames[0])) {
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
      error.file = file
      try {
        const code =
          moduleMap.get(file)?.map?.sourcesContent?.[0] ??
          moduleMap.get(file)?.code ??
          fs.readFileSync(file, 'utf8')
        stack.header = codeFrameColumns(removeSourceMapUrls(code), location, {
          highlightCode: true,
          message: stack.header,
        })
      } catch {}
    }
  }

  error.stack = stack.header + '\n\n' + tracedFrames
}

export function traceDynamicImport(error: any, skip = 0) {
  const stack = parseStackTrace(error.stack)
  if (skip) {
    stack.frames.splice(0, skip)
  }
  const ignoredFrameIndex = stack.frames.findIndex(
    frame => sausFileRE.test(frame.file) || nodeBuiltinRE.test(frame.file)
  )
  return stack.frames.slice(0, ignoredFrameIndex)
}

function isViteInternal({ file }: StackFrame) {
  return file.includes('/vite/dist/')
}
