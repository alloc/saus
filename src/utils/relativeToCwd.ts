import path from 'path'

export function relativeToCwd(file: string) {
  if (!path.isAbsolute(file)) {
    return file
  }
  file = path.relative(process.cwd(), file)
  return file.startsWith('../') ? file : './' + file
}
