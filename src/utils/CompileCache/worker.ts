import { addExitCallback } from 'catch-exit'
import { workerData } from 'worker_threads'
import path from 'path'
import fs from 'fs'
import { readFile } from 'fs/promises'
import { debug } from '../../core/debug'
import { plural } from '../plural'

const { cacheDir } = workerData as { cacheDir: string }

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
  async read(file: string) {
    let content: string | undefined
    try {
      content = await readFile(path.join(cacheDir, file), 'utf8')
      usedFiles.add(file)
    } catch {}
    return content
  },
  write(file: string, content: string) {
    const filePath = path.join(cacheDir, file)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content)
    usedFiles.add(file)
  },
  forget(file: string) {
    fs.unlinkSync(path.join(cacheDir, file))
    usedFiles.delete(file)
  },
}

// Remove unused files on exit, but only when exiting without error.
addExitCallback((_signal, _code, error) => {
  if (error || cacheIsLocked || !usedFiles.size) {
    return
  }
  try {
    const cacheList = fs.readdirSync(cacheDir)
    const numPurged = cacheList.reduce((count, key) => {
      if (!usedFiles.has(key)) {
        fs.unlinkSync(path.join(cacheDir, key))
        count += 1
      }
      return count
    }, 0)
    debug(`Purged ${plural(numPurged, 'compiled file')} that went unused`)
  } catch {}
})
