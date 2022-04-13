import * as astroCompiler from '@astrojs/compiler'
import * as esbuild from 'esbuild'
import fs from 'fs'
import { Plugin } from 'saus'
import { combineSourceMaps } from 'saus/core'

export function astroVite(): Plugin {
  return {
    name: 'astro',
    enforce: 'pre',
    saus({ root }) {
      this.load = async function (id) {
        if (id.endsWith('.astro')) {
          let code = fs.readFileSync(id, 'utf8')

          const tsResult = await astroCompiler.transform(code, {
            projectRoot: root,
            sourcemap: 'external',
            sourcefile: id,
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
