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

const stackFrameRE =
  /^ {4}at (?:(.+?)\s+\()?(?:(?:async )?(.+?):(\d+)(?::(\d+))?)(\)|$)/

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
