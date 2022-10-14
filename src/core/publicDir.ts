import { createFilter } from '@rollup/pluginutils'
import { memoizeFn } from '@utils/memoizeFn'
import createDebug from 'debug'
import fs from 'fs'
import path from 'path'
import { Promisable } from 'type-fest'
import { SausContext } from './context'

const publicDirs = new WeakMap<SausContext, PublicDir>()

export type PublicDirMode = 'write' | 'cache' | 'skip'

export interface PublicDirOptions {
  /**
   * Directory to serve as plain static assets. Files in this directory are
   * served and copied to build dist dir as-is without transform. The value
   * can be either an absolute file system path or a path relative to <root>.
   *
   * @default "public"
   */
  root?: string
  /**
   * Prefix a directory to the output path of every public file.
   */
  prefix?: string
  transform?: PublicFileTransform
  exclude?: string | RegExp | (string | RegExp)[]
}

export interface PublicDir {
  /**
   * The directory prefix that gets prepended to all file names after
   * scanning and plugin-driven path transformation.
   */
  prefix: string
  /** The public directory in absolute form */
  root: string
  /** File contents are stored here when the `mode` option is "cache". */
  cache: Record<string, Buffer>
  /** Scan the public directory and transform its files again. */
  rescan: () => Promise<void>
  /** Mappings of original files to their new names */
  renamedFiles: Record<string, string>
  /** Mappings of renamed files to their old names */
  originalFiles: Record<string, string>
  /** Exists if files have been renamed. Can be used in Vite plugin. */
  resolveId: ((id: string) => string | undefined) | undefined
  /**
   * Depending on the mode, this either writes to disk or
   * populate the `cache` property. Each commit will clear
   * the internal file cache, so calls are not idempotent.
   */
  commit: (
    mode: PublicDirMode,
    onPublicFile?: PublicFileCallback
  ) => Promise<number>
}

/**
 * Returns `null` if scanning is disabled.
 */
export async function scanPublicDir(
  context: SausContext
): Promise<PublicDir | null> {
  if (!context.publicDir) {
    return null
  }
  let publicDir = publicDirs.get(context)
  if (publicDir) {
    return publicDir
  }

  const cache: Record<string, Buffer> = {}

  const copiedFiles = new Map<string, string>()
  const writtenFiles = new Map<string, Buffer>()
  const renamedFiles = new Map<string, string>()

  const baseOutDir = path.resolve(context.root, context.config.build.outDir)
  const prefix = context.publicDir.prefix || './'
  const outDir = path.resolve(baseOutDir, prefix)

  let root = context.publicDir.root || 'public'
  if (root) {
    root = path.resolve(context.root, root)
  }

  const isExcluded = createFilter(
    context.publicDir.exclude || /^$/,
    undefined,
    { resolve: false }
  )

  const transformers = context.plugins
    .filter(p => p.transformPublicFile)
    .map(p => p.transformPublicFile) as PublicFileTransform[]

  if (context.publicDir.transform) {
    transformers.push(context.publicDir.transform)
  }

  let transform: PublicFileTransform | undefined
  if (transformers.length) {
    transform = async file => {
      const { name } = file
      for (const transform of transformers) {
        await transform(file)
      }
      if (name !== file.name) {
        renamedFiles.set(name, file.name)
      }
    }
  }

  const mkdirSync = memoizeFn(fs.mkdirSync, (mkdirSync, dir: string) => {
    mkdirSync(dir, { recursive: true })
  })

  let scanning: Promise<void> | undefined
  let renamedFileMap: Record<string, string> | undefined
  let originalFileMap: Record<string, string> | undefined

  async function scanPublicDir() {
    copiedFiles.clear()
    writtenFiles.clear()
    renamedFiles.clear()

    if (fs.existsSync(root)) {
      await collectFiles(
        root,
        outDir,
        copiedFiles,
        writtenFiles,
        isExcluded,
        transform
      )
    }

    renamedFileMap = Object.fromEntries(renamedFiles.entries())
    originalFileMap = renamedFiles.size ? {} : undefined
  }

  publicDir = {
    prefix,
    root,
    cache,
    rescan: () =>
      (scanning ||= scanPublicDir().finally(() => {
        scanning = undefined
      })),
    get renamedFiles() {
      return renamedFileMap || {}
    },
    get originalFiles() {
      return originalFileMap || {}
    },
    get resolveId() {
      if (!renamedFileMap || !originalFileMap) {
        return
      }
      return (id: string) => {
        if (id[0] == '/') {
          const [cleanedId, suffix = ''] = id.slice(1).split(/([#?].*$)/)
          const newId = renamedFileMap![cleanedId]
          if (newId) {
            originalFileMap![newId] = cleanedId
            return '/' + newId + suffix
          }
        }
      }
    },
    async commit(mode, onPublicFile) {
      const count = copiedFiles.size + writtenFiles.size
      if (!count || mode == 'skip') {
        return 0
      }

      const isWrite = mode == 'write'
      const processing: any[] = []

      for (const [srcPath, destPath] of copiedFiles) {
        const name = path.relative(outDir, destPath)
        let buffer: Buffer | undefined
        if (onPublicFile) {
          buffer = fs.readFileSync(srcPath)
          processing.push(onPublicFile(name, buffer))
        }
        Object.defineProperty(cache, name, {
          get: () => (buffer ||= fs.readFileSync(srcPath)),
          configurable: true,
          enumerable: true,
        })
        if (isWrite) {
          mkdirSync(path.dirname(destPath))
          fs.copyFileSync(srcPath, destPath)
        }
      }

      for (const [destPath, buffer] of writtenFiles) {
        const name = path.relative(outDir, destPath)
        if (onPublicFile) {
          processing.push(onPublicFile(name, buffer))
        }
        cache[name] = buffer
        if (isWrite) {
          mkdirSync(path.dirname(destPath))
          fs.writeFileSync(destPath, buffer)
        }
      }

      copiedFiles.clear()
      writtenFiles.clear()

      await Promise.all(processing)
      return count
    },
  }

  publicDirs.set(context, publicDir)
  await scanPublicDir()
  return publicDir
}

const isDebug = !!process.env.DEBUG
const debug = createDebug('saus:publicDir')

async function collectFiles(
  srcDir: string,
  destDir: string,
  copiedFiles: Map<string, string>,
  writtenFiles: Map<string, Buffer>,
  isExcluded: (id: string) => boolean,
  transform?: (file: PublicFile) => Promise<void> | void,
  srcRoot = srcDir,
  destRoot = destDir
): Promise<void> {
  for (const name of fs.readdirSync(srcDir)) {
    const srcPath = path.join(srcDir, name)
    const srcRelativePath = srcPath.slice(srcRoot.length + 1)
    if (isExcluded(name) || isExcluded(srcRelativePath)) {
      isDebug && debug(`Excluded path: "${srcRelativePath}"`)
      continue
    }
    if (fs.statSync(srcPath).isDirectory()) {
      await collectFiles(
        srcPath,
        path.join(destDir, name),
        copiedFiles,
        writtenFiles,
        isExcluded,
        transform,
        srcRoot,
        destRoot
      )
    } else if (transform) {
      const file = new PublicFile(srcRelativePath, srcPath)
      await transform(file)
      if (Object.getOwnPropertyDescriptor(file, 'skipped')) {
        isDebug && debug(`Skipped file: "${file.name}"`)
        continue
      }
      const destPath = path.join(destRoot, file.name)
      if (Object.getOwnPropertyDescriptor(file, 'buffer')) {
        writtenFiles.set(destPath, file.buffer)
      } else {
        copiedFiles.set(srcPath, destPath)
      }
    } else {
      copiedFiles.set(srcPath, path.join(destDir, name))
    }
  }
}

export type PublicFileCallback = (
  name: string,
  data: Buffer
) => Promisable<void>

export type PublicFileTransform = (file: PublicFile) => Promise<void> | void

export type { PublicFile }

class PublicFile {
  constructor(public name: string, private bufferPath: string) {}

  get buffer() {
    const buffer = fs.readFileSync(this.bufferPath)
    Object.defineProperty(this, 'buffer', { value: buffer, writable: true })
    return buffer
  }
  set buffer(buffer: Buffer) {
    Object.defineProperty(this, 'buffer', { value: buffer, writable: true })
  }

  /** The `buffer` with UTF-8 encoding */
  get text() {
    return this.buffer.toString('utf8')
  }
  set text(text: string) {
    this.buffer = Buffer.from(text, 'utf8')
  }

  /** The file extension taken from `this.name` but without a leading dot */
  get suffix() {
    return path.extname(this.name).slice(1)
  }
  set suffix(suffix: string) {
    this.name = this.name.replace(/\.[^.]+$/, '.' + suffix)
  }

  /** Skip copying this file. */
  skip() {
    Object.defineProperty(this, 'skipped', { value: true })
  }
}
