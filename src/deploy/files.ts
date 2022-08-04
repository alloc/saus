import { createCommit } from '@/node/git/createCommit'
import exec from '@cush/exec'
import fs from 'fs'
import path from 'path'
import yaml from 'yaml'

export class GitFiles {
  private _files: Record<string, File> = {}
  private _tracker: FileTracker

  constructor(readonly root: string, readonly dryRun?: boolean) {
    const knownFiles = exec
      .sync('git ls-tree --full-tree -r --name-only HEAD', { cwd: root })
      .split('\n')
    this._tracker = new FileTracker(knownFiles)
  }

  get<T = any>(name: `${string}.json`): JsonFile<T>
  get<T = any>(name: `${string}.yaml`): YamlFile<T>
  get<T extends File>(name: string, type?: Constructor<T>): T
  get(name: string, type?: Constructor<any>): any {
    if (name.endsWith('.json')) {
      type ||= JsonFile
    } else if (name.endsWith('.yaml')) {
      type ||= YamlFile
    }
    const file = (this._files[name] ||= new (type || File)(
      name,
      this._tracker,
      this
    ))
    if (type && type !== file.constructor) {
      throw Error(`File type mismatch: "${name}"`)
    }
    return file
  }

  get numChanged() {
    return this._tracker.numChanged
  }

  async commit(message: string) {
    if (this._tracker.numChanged > 0) {
      await exec('git add -A', { cwd: this.root })
      createCommit(message, { cwd: this.root })
      this._tracker.reset()
      return true
    }
    return false
  }

  async push() {
    await exec('git push', { cwd: this.root })
  }
}

interface Constructor<T> {
  new (...args: any[]): T
}

/**
 * A file tracked by Git for deployment purposes.
 */
export class File {
  private _data?: Buffer
  private _known: boolean
  constructor(
    /** File name relative to git root */
    readonly name: string,
    private _tracker: FileTracker,
    private _files: GitFiles
  ) {
    this._known = this._tracker.known.includes(name)
  }

  get path() {
    return path.join(this._files.root, this.name)
  }

  get exists(): boolean {
    return this._known
      ? !this._tracker.deleted.has(this)
      : this._tracker.added.has(this)
  }

  /** Read as raw bytes */
  getBuffer(): Buffer
  /** Read with the given text encoding. */
  getBuffer(encoding: BufferEncoding): string
  // @internal
  getBuffer(encoding?: BufferEncoding): string | Buffer {
    if (this.exists) {
      if (this._files.dryRun && this._data) {
        return this._data
      }
      try {
        return fs.readFileSync(this.path, encoding)
      } catch (e: any) {
        if (e.code !== 'ENOENT') {
          throw e
        }
        this._tracker.onDelete(this, this._known)
      }
    }
    return encoding !== undefined ? '' : Buffer.alloc(0)
  }

  /** Set the raw byte data */
  setBuffer(data: Buffer): void
  /** Set the file's UTF-8 data */
  setBuffer(data: string, encoding: BufferEncoding): void
  // @internal
  setBuffer(data: string | Buffer, encoding?: BufferEncoding): void {
    if (this._files.dryRun) {
      this._data = Buffer.isBuffer(data) ? data : Buffer.from(data, encoding)
    } else {
      fs.mkdirSync(path.dirname(this.path), { recursive: true })
      fs.writeFileSync(this.path, data, { encoding })
    }
    this._tracker.onChange(this, this._known)
  }

  delete() {
    if (!this.exists) return
    if (this._files.dryRun) {
      this._data = undefined
    } else {
      try {
        fs.unlinkSync(this.path)
      } catch {
        // Something else deleted this file.
      }
    }
    this._tracker.onDelete(this, this._known)
  }
}

type Replacer = (this: any, key: any, value: any) => any

export class JsonFile<T = any> extends File {
  getData(): T | undefined {
    const text = this.getBuffer('utf8')
    return text ? JSON.parse(text) : undefined
  }
  setData(data: T, replacer?: Replacer) {
    const text = JSON.stringify(data, replacer, 2)
    this.setBuffer(Buffer.from(text))
  }
}

export class YamlFile<T = any> extends File {
  getData(): T | undefined {
    const text = this.getBuffer('utf8')
    return text ? yaml.parse(text) : undefined
  }
  setData(data: T, replacer?: Replacer) {
    const text = yaml.stringify(data, replacer, {
      indent: 2,
      aliasDuplicateObjects: false,
    })
    this.setBuffer(Buffer.from(text))
  }
}

/** @internal */
class FileTracker {
  added = new Set<File>()
  updated = new Set<File>()
  deleted = new Set<File>()

  constructor(public known: string[]) {}

  get numChanged() {
    return this.added.size + this.updated.size + this.deleted.size
  }

  reset() {
    const known: string[] = []
    const deleted = Array.from(this.deleted, file => file.name)
    for (const name of this.known) {
      if (!deleted.includes(name)) {
        known.push(name)
      }
    }
    for (const { name } of this.added) {
      known.push(name)
    }
    this.added.clear()
    this.updated.clear()
    this.deleted.clear()
  }

  onChange(file: File, known: boolean) {
    if (known) {
      this.deleted.delete(file)
      this.updated.add(file)
    } else {
      this.added.add(file)
    }
  }

  onDelete(file: File, known: boolean) {
    if (known) {
      this.updated.delete(file)
      this.deleted.add(file)
    } else {
      this.added.delete(file)
    }
  }
}
