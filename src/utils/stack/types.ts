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
