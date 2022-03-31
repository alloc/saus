import { addExitCallback } from 'catch-exit'
import { workerData } from 'worker_threads'
import path from 'path'
import fs from 'fs'
import { readFile } from 'fs/promises'
import { debug } from '../../core/debug'
import { plural } from '../plural'
import { debounce } from 'ts-debounce'

const { cacheDir } = workerData as { cacheDir: string }
const fileMappingsPath = path.join(cacheDir, '_mappings.json')

let fileMappings: Record<string, string>
try {
  fileMappings = JSON.parse(fs.readFileSync(fileMappingsPath, 'utf8'))
} catch {
  fileMappings = {}
}

const reverseFileMappings = Object.fromEntries(
  Object.keys(fileMappings).map(file => [fileMappings[file], file])
)

/** These files should not be deleted when the process exits. */
const usedFiles = new Set<string>()

export default ([cmd, ...args]: [keyof Commands, ...any[]]) => {
  return (commands[cmd] as Function)(...args)
}

export type Commands = typeof commands

let cacheIsLocked = false

const commands = {
  /** Prevent file cleanup on spontaneous crashes. */
  lock() {
    cacheIsLocked = true
  },
  /** Allow file cleanup when the process exits. */
  unlock() {
    cacheIsLocked = false
  },
  keep(file: string) {
    usedFiles.add(file)
  },
  async read(key: string, sourcePath?: string) {
    if (sourcePath) {
      const oldKey = fileMappings[sourcePath]
      if (oldKey) {
        this.forget(oldKey)
      }
      reverseFileMappings[key] = sourcePath
      writeFileMappings()
    }
    let content: string | undefined
    try {
      content = await readFile(path.join(cacheDir, key), 'utf8')
      usedFiles.add(key)
    } catch {}
    return content
  },
  write(key: string, content: string) {
    const cachePath = path.join(cacheDir, key)
    fs.mkdirSync(path.dirname(cachePath), { recursive: true })
    fs.writeFileSync(cachePath, content)
    usedFiles.add(key)
    const sourcePath = reverseFileMappings[key]
    if (sourcePath) {
      fileMappings[sourcePath] = key
    }
  },
  forget(key: string) {
    fs.unlinkSync(path.join(cacheDir, key))
    const sourcePath = reverseFileMappings[key]
    delete fileMappings[sourcePath]
    delete reverseFileMappings[key]
    usedFiles.delete(key)
  },
}

const writeFileMappings = debounce(() => {
  fs.mkdirSync(path.dirname(fileMappingsPath), { recursive: true })
  fs.writeFileSync(fileMappingsPath, JSON.stringify(fileMappings, null, 2))
})

// Remove unused files on exit, but only when exiting without error.
addExitCallback((_signal, _code, error) => {
  if (error || cacheIsLocked || !usedFiles.size) {
    return
  }
  const crawl = (dir: string, onFile: (file: string) => void) => {
    const prefix = path.relative(cacheDir, dir)
    for (let file of fs.readdirSync(dir)) {
      file = path.join(prefix, file)
      if (reverseFileMappings[file]) {
        continue // Preserve the cached file if still needed.
      }
      try {
        crawl(path.join(cacheDir, file), onFile)
      } catch {
        onFile(file)
      }
    }
  }
  try {
    let numPurged = 0
    crawl(cacheDir, file => {
      fs.unlinkSync(path.join(cacheDir, file))
      numPurged++
    })
    debug(`Purged ${plural(numPurged, 'compiled file')} that went unused`)
  } catch {}
})
