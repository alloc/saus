import fs from 'fs'
import path from 'path'
import { debounce } from 'ts-debounce'

export type FileMappings = Record<string, string> & {
  path: string
}

export function loadFileMappings(cacheDir: string) {
  const fileMappingsPath = path.join(cacheDir, '_mappings.json')

  let fileMappings: Record<string, string>
  try {
    fileMappings = JSON.parse(fs.readFileSync(fileMappingsPath, 'utf8'))
  } catch {
    fileMappings = {}
  }
  Object.defineProperty(fileMappings, 'path', {
    value: fileMappingsPath,
  })

  return fileMappings as FileMappings
}

const existingPaths = new Set<string>()

export const saveFileMappings = debounce((fileMappings: FileMappings) => {
  if (!existingPaths.has(fileMappings.path)) {
    fs.mkdirSync(path.dirname(fileMappings.path), { recursive: true })
    existingPaths.add(fileMappings.path)
  }
  fs.writeFileSync(fileMappings.path, JSON.stringify(fileMappings, null, 2))
})
