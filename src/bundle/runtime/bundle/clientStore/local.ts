import fs from 'fs'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)

// Assume the working directory is the `build.outDir` option.
export function loadModule(id: string): Promise<string> {
  return readFile(id, 'utf8')
}

// Assume the working directory is the `build.outDir` option.
export function loadAsset(id: string): Promise<Buffer> {
  return readFile(id)
}
