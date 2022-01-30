import fs from 'fs'
import md5Hex from 'md5-hex'
import path from 'path'
import { addExitCallback } from 'catch-exit'
import { debug } from '../core/debug'
import { plural } from './plural'

/**
 * For caching compiled files on disk by the hash of their
 * original contents. The cache cleans up unused files before
 * the process exits cleanly. The cache can be locked to
 * prevent clean up in the case of unexpected errors.
 */
export class CompileCache {
  private used = new Set<string>()

  constructor(readonly name: string, private root: string) {
    // Remove unused files on exit, but only when exiting without error.
    addExitCallback((_signal, _code, error) => {
      if (error || this.locked || !this.used.size) {
        return
      }
      const cacheDir = path.join(this.root, this.name)
      const cacheList = fs.readdirSync(cacheDir)
      const numPurged = cacheList.reduce((count, key) => {
        if (!this.used.has(key)) {
          fs.unlinkSync(path.join(cacheDir, key))
          count += 1
        }
        return count
      }, 0)
      debug(`Purged ${plural(numPurged, 'compiled file')} that went unused`)
    })
  }

  /** When true, the cache won't delete unused files on process exit. */
  locked = false

  key(code: string) {
    return md5Hex(code).slice(0, 16) + '.js'
  }

  get(key: string) {
    let content: string | null = null
    try {
      content = fs.readFileSync(path.join(this.root, this.name, key), 'utf8')
      this.used.add(key)
    } catch {}
    return content
  }

  set(key: string, code: string) {
    const filename = path.join(this.root, this.name, key)
    fs.mkdirSync(path.dirname(filename), { recursive: true })
    fs.writeFileSync(filename, code)
    this.used.add(key)
  }
}
