import { noop } from '@/utils/noop'
import { createFilter } from '@rollup/pluginutils'
import fs from 'fs/promises'
import imagemin from 'imagemin'
import webp, { Options as WebpOptions } from 'imagemin-webp'
import { red } from 'kleur/colors'
import { success } from 'misty'
import { MistyTask, startTask } from 'misty/task'
import path from 'path'
import { Plugin } from 'saus'
import {
  controlExecution,
  limitConcurrency,
  murmurHash,
  plural,
} from 'saus/core'

export interface Options extends WebpOptions {
  /** By default, all `.png` and `.jpg` files are converted. */
  include?: (string | RegExp)[]
  exclude?: (string | RegExp)[]
  /** Disable logging */
  silent?: boolean
  /** Log every file that is converted */
  verbose?: boolean
}

const urlRE = /(\?|&)url(?:&|$)/
const hasFreeThread = limitConcurrency()
const convertedImages = new Map<string, Buffer>()

/**
 * Convert images to WebP format.
 *
 * Images imported by JS modules are converted by default.  \
 * Add the `copyPublicDir` plugin to convert images in `public` directory as well.
 */
export function convertToWebp(options: Options = {}): Plugin {
  let numConverted = 0
  let filter: (id: string) => boolean
  let task: MistyTask | undefined

  const converter = webp(options)
  const convert = controlExecution(async (data: Buffer) => {
    data = await imagemin.buffer(data, { plugins: [converter] })
    numConverted++
    return data
  }).with((ctx, args, wasQueued) => {
    if (hasFreeThread(ctx, wasQueued)) {
      if (!ctx.activeCalls.size && !options.silent) {
        task = startTask('Converting images to WebP')
      }
      ctx
        .execute(args)
        .catch(noop)
        .then(() => {
          if (!ctx.activeCalls.size) {
            task?.finish()
          }
        })
    } else {
      ctx.queuedCalls.push(args)
    }
  })

  return {
    name: 'saus:webp',
    apply: 'build',
    enforce: 'pre',
    saus({ config, logger }) {
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
        if (!filter(id)) {
          return
        }
        if (urlRE.test(id)) {
          id = id.replace(urlRE, '$1').replace(/[\?&]$/, '')
        } else if (!config.assetsInclude(id)) {
          return
        }

        let buffer = convertedImages.get(id)
        if (!buffer) {
          try {
            buffer = await fs.readFile(id)
          } catch {
            if (id[0] !== '/') {
              return
            }
            const publicId = path.join(config.publicDir, id.slice(1))
            buffer = await fs.readFile(publicId)
          }
          try {
            buffer = await convert(buffer)
            convertedImages.set(id, buffer)
            if (options.verbose) {
              success(`[webp] Converted file: "${id}"`)
            }
          } catch (e: any) {
            return void logger.error(
              red(`[!] Converting "${id}" to WebP failed:\n`) + e.stack
            )
          }
        }

        const fileName = path.join(
          config.build.assetsDir,
          id.replace(/\.[^.]+$/, '.' + murmurHash(buffer) + '.webp')
        )

        if (!config.build.ssr)
          this.emitFile({
            type: 'asset',
            fileName,
            source: buffer,
          })

        return `export default "${config.base}${fileName}"`
      }
      this.generateBundle = () => {
        if (!options.silent && numConverted > 0) {
          success(`${plural(numConverted, 'image')} converted to WebP`)
        }
      }
      return {
        async transformPublicFile(file) {
          if (!filter(file.name)) {
            return
          }
          try {
            file.buffer = await convert(file.buffer)
            file.suffix = 'webp'
          } catch (e: any) {
            logger.error(
              red(`[!] Converting "${file.name}" to WebP failed:\n`) + e.stack
            )
          }
        },
      }
    },
  }
}
