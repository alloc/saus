import exec from '@cush/exec'

export function bindExec(...boundArgs: exec.Args): typeof exec.async

export function bindExec(
  cmd: string,
  ...boundArgs: exec.Args
): typeof exec.async

export function bindExec(...boundArgs: any[]) {
  const boundCmd = typeof boundArgs[0] == 'string' ? boundArgs.shift() : ''
  return (cmd: string, ...args: exec.Args) =>
    exec((boundCmd ? boundCmd + ' ' : '') + cmd, ...args, ...boundArgs)
}
