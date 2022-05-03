import * as esbuild from 'esbuild'
import fs from 'fs'
import { Plugin } from 'saus'
import { combineSourceMaps } from 'saus/core'

let astroCompiler: typeof import('@astrojs/compiler')

export const ssrRuntimeId = '@saus/astro-runtime'

export function astroVite(options: any): Plugin {
  return {
    name: 'astro',
    enforce: 'pre',
    config: () => ({
      resolve: {
        alias: {
          [ssrRuntimeId]: require.resolve(ssrRuntimeId),
        },
      },
    }),
    async saus({ root }) {
      const dynamicImport = (0, eval)('id => import(id)')
      astroCompiler = await dynamicImport('@astrojs/compiler')

      this.load = async function (id) {
        if (id.endsWith('.astro')) {
          let code = fs.readFileSync(id, 'utf8')

          const tsResult = await astroCompiler.transform(code, {
            projectRoot: root,
            sourcemap: 'external',
            sourcefile: id,
            internalURL: ssrRuntimeId,
          })

          const jsResult = await esbuild.transform(tsResult.code, {
            loader: 'ts',
            sourcemap: 'external',
            sourcefile: id,
          })

          const map = combineSourceMaps(id, [
            JSON.parse(jsResult.map),
            JSON.parse(tsResult.map),
          ])

          return {
            code: jsResult.code,
            map,
          }
        }
      }
    },
  }
}
