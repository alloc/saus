import { createFilter } from '@rollup/pluginutils'
import createDebug from 'debug'
import fs from 'fs'
import { green } from 'kleur/colors'
import { success } from 'misty'
import path from 'path'
import { dataToEsm, endent, Plugin, vite } from '../core'

const isDebug = !!process.env.DEBUG
const debug = createDebug('saus:publicDir')

export type PublicFileTransform = (file: PublicFile) => Promise<void> | void

export type CopyPublicOptions = {
  /**
   * Prefix a directory to the output path of every public file.
   */
  prefix?: string
  transform?: PublicFileTransform
  exclude?: string | RegExp | (string | RegExp)[]
}

/**
 * Copy files from `publicDir` into the `build.outDir` directory,
 * as defined in your Vite config.
 */
export function copyPublicDir(options: CopyPublicOptions = {}) {
  let plugins: readonly vite.Plugin[]
  let publicDir: string
  let outDir: string

  const copiedFiles = new Map<string, string>()
  const writtenFiles = new Map<string, Buffer>()
  const renamedFiles = new Map<string, string>()

  function commitFiles() {
    if (!publicDir) {
      return
    }
    for (const [srcPath, destPath] of copiedFiles) {
      mkdirSync(path.dirname(destPath))
      fs.copyFileSync(srcPath, destPath)
    }
    for (const [destPath, buffer] of writtenFiles) {
      mkdirSync(path.dirname(destPath))
      fs.writeFileSync(destPath, buffer)
    }
    success(
      `${copiedFiles.size + writtenFiles.size} files copied from ${green(
        path
          .relative(process.cwd(), publicDir)
          .replace(/^([^.])/, './$1')
          .replace(/([^/])$/, '$1/')
      )}`
    )
  }

  const isExcluded = createFilter(options.exclude || /^$/, undefined, {
    resolve: false,
  })

  const resolver: Plugin = {
    name: 'publicDir:resolver',
    apply: 'build',
    enforce: 'pre',
  }

  const copier: Plugin = {
    name: 'publicDir:copier',
    apply: 'build',
    configResolved(config) {
      plugins = config.plugins
    },
    async saus(context) {
      outDir = path.resolve(
        context.root,
        context.config.build.outDir,
        options.prefix || ''
      )
      publicDir = context.config.publicDir
      if (publicDir) {
        publicDir = path.resolve(context.root, publicDir)
      }

      const transformers = context.plugins
        .filter(p => p.transformPublicFile)
        .map(p => p.transformPublicFile) as PublicFileTransform[]

      if (options.transform) {
        transformers.push(options.transform)
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

      if (publicDir && fs.existsSync(publicDir)) {
        await collectFiles(
          publicDir,
          outDir,
          copiedFiles,
          writtenFiles,
          isExcluded,
          transform
        )
      }

      const renamedFileMap = Object.fromEntries(renamedFiles.entries())

      // Rewrite JS imports of public files.
      if (renamedFiles.size) {
        const originalFileMap: Record<string, string> = {}

        resolver.resolveId = id => {
          if (id[0] == '/') {
            const [cleanedId, suffix = ''] = id.slice(1).split(/([#?].*$)/)
            const newId = renamedFileMap[cleanedId]
            if (newId) {
              originalFileMap[newId] = cleanedId
              return '/' + newId + suffix
            }
          }
        }

        resolver.load = async function (id, options) {
          if (id[0] == '/') {
            const [cleanedId, suffix = ''] = id.slice(1).split(/([#?].*$)/)
            const originalId = originalFileMap[cleanedId]
            if (!originalId) {
              return
            }
            const originalUrl = '/' + originalId + suffix
            for (const plugin of plugins) {
              if (!plugin.load || plugin == resolver) {
                continue
              }
              const loadResult = await plugin.load.call(
                this,
                originalUrl,
                options
              )
              if (loadResult != null) {
                return loadResult
              }
            }
          }
        }
      }

      return {
        async fetchBundleImports(modules) {
          if (renamedFiles.size) {
            // Rewrite HTML references of public files.
            const renamer = modules.addModule({
              id: '@saus/copyPublicDir/renamer.js',
              code: endent`
                import {resolveHtmlImports} from "@saus/html"
                ${dataToEsm(renamedFileMap, 'const renameMap')}
                resolveHtmlImports(id => renameMap[id])
              `,
            })

            return [renamer.id]
          }
        },
        receiveBundle: bundle => bundle.path && commitFiles(),
        onWritePages: commitFiles,
      }
    },
  }

  return [resolver, copier]
}

const mkdirSync = memoizeFn(fs.mkdirSync, (mkdirSync, dir: string) => {
  mkdirSync(dir, { recursive: true })
})

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
