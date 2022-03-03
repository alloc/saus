import imagemin from 'imagemin'
import webp, { Options as WebpOptions } from 'imagemin-webp'
import fs from 'fs/promises'
import path from 'path'
import { Plugin } from 'saus'
import { limitConcurrency, controlExecution, plural } from 'saus/core'
import { createFilter } from '@rollup/pluginutils'
import md5Hex from 'md5-hex'
import { MistyTask, startTask } from 'misty/task'
import { success } from 'misty'
import { red } from 'kleur/colors'

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
      ctx.execute(args).finally(() => {
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
    configResolved(config) {
      // Leave client builds alone.
      if (!config.build.ssr) {
        return
      }
      const { logger } = config
      this.load = async function (id) {
        if (id.startsWith('\0')) {
          return
        }
        if (!filter(id)) {
          return
        }
        if (urlRE.test(id)) {
          id = id.replace(urlRE, '$1').replace(/[\?&]$/, '')
        } else if (!config.assetsInclude(id)) {
          return
        }

        let buffer!: Buffer
        try {
          buffer = await fs.readFile(id)
        } catch {
          if (id[0] === '/') {
            const publicId = path.join(config.publicDir, id.slice(1))
            buffer = await fs.readFile(publicId)
          }
        }

        try {
          buffer = await convert(buffer)
          if (options.verbose) {
            success(`[webp] Converted file: "${id}"`)
          }
        } catch (e: any) {
          return void logger.error(
            red(`[!] Converting "${id}" to WebP failed:\n`) + e.stack
          )
        }

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
      this.generateBundle = () => {
        if (!options.silent) {
          success(`${plural(numConverted, 'image')} converted to WebP`)
        }
      }
    },
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
