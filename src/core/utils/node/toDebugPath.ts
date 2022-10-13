import { relativeToCwd } from '@utils/node/relativeToCwd'
import fs from 'fs'

export function toDebugPath(file: string) {
  return fs.existsSync(file.replace(/[#?].*$/, '')) ? relativeToCwd(file) : file
}
