import md5Hex from 'md5-hex'
import fs from 'fs'
import path from 'path'
import { loadFileMappings, saveFileMappings } from './CompileCache/fileMappings'

/**
 * For caching compiled files on disk by the hash of their
 * original contents. The cache cleans up unused files before
 * the process exits cleanly. The cache can be locked to
 * prevent clean up in the case of unexpected errors.
 */
export class CompileCache {
  protected fileMappings = loadFileMappings(this.path)

  constructor(readonly name: string, private root: string) {}

  get path() {
    return path.join(this.root, this.name)
  }

  key(content: string, name = '') {
    const hash = content && md5Hex(content).slice(0, name ? 8 : 16)
    return name + (content ? (name ? '.' : '') + hash : '') + '.js'
  }

  get(key: string, sourcePath?: string) {
    if (sourcePath) {
      sourcePath = path.relative(this.root, sourcePath)
      const oldKey = this.fileMappings[sourcePath]
      if (oldKey) {
        fs.unlinkSync(path.join(this.path, oldKey))
      }
      this.fileMappings[sourcePath] = key
      saveFileMappings(this.fileMappings)
    }
    try {
      return fs.readFileSync(path.join(this.path, key), 'utf8')
    } catch {}
  }

  set(key: string, content: string) {
    const filePath = path.join(this.path, key)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content)
    return filePath
  }
}
