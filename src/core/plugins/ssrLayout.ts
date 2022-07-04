import { Plugin } from '../vite'

const includeRE = /\.m?[tj]sx?$/
const layoutExport = /\bexport default defineLayout\(\{/

/**
 * When a layout module is reloaded, it needs to update the previous
 * module instance, since the routes module isn't always reloaded
 * to receive the new layout objects.
 */
export function ssrLayoutPlugin(): Plugin {
  return {
    name: 'saus:layout:ssr',
    enforce: 'pre',
    transform(code, id, opts) {
      if (opts?.ssr && includeRE.test(id)) {
        let isLayoutModule = false
        code = code.replace(layoutExport, match => {
          isLayoutModule = true
          // Inject a file property.
          return match + `file: "${id}",`
        })
        if (isLayoutModule) {
          return code
        }
      }
    },
  }
}
