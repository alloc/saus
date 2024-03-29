import { Plugin, SausPlugin, vite } from '@/core'
import { dataToEsm } from '@runtime/dataToEsm'
import { plural } from '@utils/plural'
import endent from 'endent'
import { green } from 'kleur/colors'
import { success } from 'misty'
import path from 'path'
import { Promisable } from 'type-fest'
import { scanPublicDir } from '../publicDir'

export function copyPublicDir() {
  let plugins: readonly vite.Plugin[]

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
    saus: context => ({
      async receiveBundleOptions({ publicDirMode = 'write' }) {
        const publicDir = await scanPublicDir(context)
        if (!publicDir) {
          return
        }

        const commit = async (
          onPublicFile?: (name: string, data: Buffer) => Promisable<void>
        ) => {
          const count = await publicDir.commit(publicDirMode, onPublicFile)
          void (
            count > 0 &&
            publicDirMode == 'write' &&
            context.logger.isLogged('info') &&
            success(
              `${plural(count, 'file')} copied from ${green(
                path
                  .relative(process.cwd(), publicDir.root)
                  .replace(/^([^.])/, './$1')
                  .replace(/([^/])$/, '$1/')
              )}`
            )
          )
        }

        // Rewrite JS imports of public files.
        const { resolveId } = publicDir
        if (resolveId) {
          const { originalFiles } = publicDir
          resolver.resolveId = resolveId
          resolver.load = async function (id, options) {
            if (id[0] == '/') {
              const [cleanedId, suffix = ''] = id.slice(1).split(/([#?].*$)/)
              const originalId = originalFiles[cleanedId]
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

        const assign = Object.assign as <T>(target: T, props: Partial<T>) => T
        assign(this as SausPlugin, {
          onRuntimeConfig(config) {
            config.publicDir = publicDir.prefix
          },
          async injectModules({ prependModule }) {
            if (resolveId) {
              prependModule({
                id: '@saus/copyPublicDir/renamer.js',
                // Rewrite HTML references of public files.
                code: endent`
                  import {resolveHtmlImports} from "saus/html/resolver"
                  ${dataToEsm(publicDir.renamedFiles, 'const renamedFiles')}
                  resolveHtmlImports(id => renamedFiles[id])
                `,
              })
            }
          },
          // Only write if a bundle path is present or when the `onPublicFile`
          // option is defined.
          receiveBundle: (bundle, options) => {
            if (options.onPublicFile) {
              return commit(options.onPublicFile)
            }
            if (bundle.path) {
              return commit()
            }
          },
          // Always write to disk when `saus build` runs.
          onWritePages: () => commit(),
        })
      },
    }),
  }

  return [resolver, copier]
}
