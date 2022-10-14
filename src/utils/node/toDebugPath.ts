import fs from 'fs'
import { relativeToCwd } from './relativeToCwd'

export function toDebugPath(file: string) {
  return fs.existsSync(file.replace(/[#?].*$/, '')) ? relativeToCwd(file) : file
}
