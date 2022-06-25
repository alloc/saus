import { createCommit } from '@/node/git'
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

  async commit(message: string) {
    if (this._tracker.numChanged > 0) {
      await exec('git add -A', { cwd: this.root })
      await createCommit(message, { cwd: this.root })
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
  getBuffer(encoding: string): string
  getBuffer(encoding?: string): string | Buffer {
    if (this.exists) {
      if (this._files.dryRun && this._data) {
        return this._data
      }
      return fs.readFileSync(this.path, encoding as any)
    }
    return encoding !== undefined ? '' : Buffer.alloc(0)
  }

  /** Set the raw byte data */
  setBuffer(data: Buffer): void {
    if (this._files.dryRun) {
      this._data = data
    } else {
      fs.writeFileSync(this.path, data)
    }
    this._tracker.onChange(this, this._known)
  }

  delete() {
    if (this._files.dryRun) {
      this._data = undefined
    } else {
      fs.unlinkSync(this.path)
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
    const text = yaml.stringify(data, replacer, 2)
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
