import md5Hex from 'md5-hex'
import fs from 'fs'
import path from 'path'
import { loadTinypool, WorkerPool } from './tinypool'
import { Commands } from './CompileCache/worker'
import { debounce } from 'ts-debounce'

type FileMappings = Record<string, string> & {
  _path: string
}

/**
 * For caching compiled files on disk by the hash of their
 * original contents. The cache cleans up unused files before
 * the process exits cleanly. The cache can be locked to
 * prevent clean up in the case of unexpected errors.
 */
export class CompileCache {
  protected worker: Promise<WorkerPool<Commands>>

  constructor(readonly name: string, private root: string) {
    this.worker = loadTinypool().then(Tinypool => {
      return new Tinypool({
        filename: path.resolve(__dirname, 'utils/CompileCache/worker.js'),
        concurrentTasksPerWorker: Infinity,
        idleTimeout: Infinity,
        maxThreads: 1,
        workerData: { cacheDir: this.path },
      })
    })
  }

  get path() {
    return path.join(this.root, this.name)
  }

  key(content: string, name = '') {
    const hash = content && md5Hex(content).slice(0, name ? 8 : 16)
    return name + (content ? (name ? '.' : '') + hash : '') + '.js'
  }

  async get(key: string, filename?: string) {
    if (filename) {
      filename = path.relative(this.root, filename)
    }
    return (await this.worker).run(['read', key, filename])
  }

  async set(key: string, content: string) {
    return (await this.worker)
      .run(['write', key, content])
      .then(() => path.join(this.path, key))
  }

  async keep(key: string) {
    return (await this.worker).run(['keep', key])
  }

  async lock() {
    return (await this.worker).run(['lock'])
  }

  async unlock() {
    return (await this.worker).run(['unlock'])
  }
}
