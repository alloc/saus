import imagemin from 'imagemin'
import webp, { Options as WebpOptions } from 'imagemin-webp'
import fs from 'fs/promises'
import path from 'path'
import { Plugin } from 'saus'
import { createFilter } from '@rollup/pluginutils'
import md5Hex from 'md5-hex'

export interface Options extends WebpOptions {
  /** By default, all `.png` and `.jpg` files are converted. */
  include?: (string | RegExp)[]
  exclude?: (string | RegExp)[]
}

const urlRE = /(\?|&)url(?:&|$)/

export function convertToWebp(options: Options = {}): Plugin {
  const converter = webp(options)
  let filter: (id: string) => boolean

  return {
    name: 'saus:webp',
    enforce: 'pre',
    configResolved(config) {
      if (!config.build.ssr) {
        return
      }
      // Ignore public files in the `load` hook, since those are
      // handled in the `transformPublicFile` hook.
      const publicFileRE = new RegExp(
        '^' + path.resolve(config.root, config.publicDir) + '/'
      )
      filter = createFilter(
        options.include || [/\.(png|jpe?g)$/],
        (options.exclude || []).concat(publicFileRE),
        { resolve: false }
      )
      this.load = async function (id) {
        if (!id.startsWith('\0') && filter(id)) {
          if (urlRE.test(id)) {
            id = id.replace(urlRE, '$1').replace(/[\?&]$/, '')
          } else if (!config.assetsInclude(id)) {
            return
          }

          let buffer = await fs.readFile(id)
          buffer = await imagemin.buffer(buffer, {
            plugins: [converter],
          })

          let fileName = path.join(
            config.build.assetsDir,
            id.replace(/\.[^.]+$/, '.' + md5Hex(buffer).slice(0, 8) + '.webp')
          )
          this.emitFile({
            type: 'asset',
            fileName,
            source: buffer,
          })

          return `export default "${config.base}${fileName}"`
        }
      }
    },
    saus: {
      async transformPublicFile(file) {
        if (filter(file.name)) {
          file.suffix = 'webp'
          file.buffer = await imagemin.buffer(file.buffer, {
            plugins: [converter],
          })
        }
      },
    },
  }
}
