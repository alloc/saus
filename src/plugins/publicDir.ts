import fs from 'fs'
import path from 'path'
import { Plugin, endent, serializeToEsm } from '../core'

export type PublicFileTransform = (file: PublicFile) => Promise<void> | void

export type CopyPublicOptions = {
  transform?: PublicFileTransform
}

/**
 * Copy files from `publicDir` into the `build.outDir` directory,
 * as defined in your Vite config.
 */
export function copyPublicDir(options: CopyPublicOptions = {}): Plugin {
  let resolveId: ((id: string) => string | undefined) | undefined
  let transform: PublicFileTransform | undefined
  let publicDir: string | false
  let outDir: string

  const copiedFiles = new Map<string, string>()
  const writtenFiles = new Map<string, Buffer>()
  const renamedFiles = new Map<string, string>()

  function commitFiles() {
    for (const [srcPath, destPath] of copiedFiles) {
      mkdirSync(path.dirname(destPath))
      fs.copyFileSync(srcPath, destPath)
    }
    for (const [destPath, buffer] of writtenFiles) {
      mkdirSync(path.dirname(destPath))
      fs.writeFileSync(destPath, buffer)
    }
  }

  return {
    name: copyPublicDir.name,
    apply: 'build',
    resolveId(id) {
      return resolveId?.(id)
    },
    saus: {
      onContext(context) {
        outDir = context.config.build?.outDir ?? 'dist'
        publicDir = context.config.publicDir ?? 'public'
        if (publicDir) {
          publicDir = path.resolve(context.root, publicDir)
        }

        const transformers = context.plugins
          .filter(p => p.transformPublicFile)
          .map(p => p.transformPublicFile) as PublicFileTransform[]

        if (options.transform) {
          transformers.push(options.transform)
        }

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
      },
      async fetchBundleImports(modules) {
        if (publicDir && fs.existsSync(publicDir)) {
          await collectFiles(
            publicDir,
            outDir,
            copiedFiles,
            writtenFiles,
            transform
          )
        }
        if (renamedFiles.size) {
          const renameMap = Object.fromEntries(renamedFiles.entries())
          console.log({ renameMap })

          // Rewrite JS imports of public files.
          resolveId = id => renameMap[id]

          // Rewrite HTML references of public files.
          const renamer = modules.addModule({
            id: '@saus/copyPublicDir/renamer.js',
            code: endent`
              import {resolveHtmlImports} from "@saus/html"
              ${serializeToEsm(renameMap, 'const renameMap')}
              resolveHtmlImports(id => renameMap[id])
            `,
          })

          return [renamer.id]
        }
      },
      onWriteBundle: commitFiles,
      onWritePages: commitFiles,
    },
  }
}

const mkdirSync = memoizeFn(fs.mkdirSync, (mkdirSync, dir: string) => {
  mkdirSync(dir, { recursive: true })
})

async function collectFiles(
  srcDir: string,
  destDir: string,
  copiedFiles: Map<string, string>,
  writtenFiles: Map<string, Buffer>,
  transform?: (file: PublicFile) => Promise<void> | void,
  srcRoot = srcDir,
  destRoot = destDir
): Promise<void> {
  for (const name of fs.readdirSync(srcDir)) {
    const srcPath = path.join(srcDir, name)
    if (fs.statSync(srcPath).isDirectory()) {
      await collectFiles(
        srcPath,
        path.join(destDir, name),
        copiedFiles,
        writtenFiles,
        transform,
        srcRoot,
        destRoot
      )
    } else if (transform) {
      const file = new PublicFile(srcPath.slice(srcRoot.length + 1), srcPath)
      await transform(file)
      if (!Object.getOwnPropertyDescriptor(file, 'skipped')) {
        const destPath = path.join(destRoot, file.name)
        mkdirSync(path.dirname(destPath))
        if (Object.getOwnPropertyDescriptor(file, 'buffer')) {
          writtenFiles.set(destPath, file.buffer)
        } else {
          copiedFiles.set(srcPath, destPath)
        }
      }
    } else {
      copiedFiles.set(srcPath, path.join(destDir, name))
    }
  }
}

function memoizeFn<T, Args extends any[], Return>(
  fn: T,
  call: (fn: T, ...args: Args) => Return
): (...args: Args) => Return {
  const cache = new Map<string, any>()
  return (...args: Args) => {
    const cacheKey = JSON.stringify(args)
    if (!cache.has(cacheKey)) {
      const result = call(fn, ...args)
      cache.set(cacheKey, result)
      return result
    }
    return cache.get(cacheKey)
  }
}

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
