import { transformAsync } from '../babel'
import { SourceMap } from '../bundle/sourceMap'
import { Plugin } from '../core/vite'

/**
 * Transform `defineStateModule` calls for client-side use.
 */
export function transformClientState(): Plugin {
  const includeRE = /\.m?[tj]sx?$/
  return {
    name: 'saus:transformClientState',
    enforce: 'pre',
    async transform(code, id, ssr) {
      if (ssr) {
        return // SSR needs the loader function
      }
      if (!includeRE.test(id)) {
        return // Unsupported file type
      }
      if (id.includes('/saus/src/client/')) {
        return // Saus core modules
      }
      if (/\bdefineStateModule\b/.test(code)) {
        const result = await transformAsync(code, id, [
          {
            visitor: {
              CallExpression(path) {
                const callee = path.get('callee')
                if (callee.isIdentifier({ name: 'defineStateModule' })) {
                  // Remove the loader function.
                  path.get('arguments')[1].remove()
                }
              },
              ImportDeclaration(path) {
                const source = path.get('source').node.value
                if (source == 'saus' || source == 'saus/core') {
                  // Remove imports of "saus" and "saus/core"
                  path.remove()
                }
              },
            },
          },
        ])
        if (result) {
          return result as { code: string; map?: SourceMap }
        }
      }
    },
  }
}
