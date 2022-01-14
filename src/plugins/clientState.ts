import { warn } from 'misty'
import { babel, getBabelConfig, NodePath, t } from '../babel'
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
      if (id.includes('/saus/src/')) {
        return // Saus core modules
      }
      if (/\bdefineStateModule\b/.test(code)) {
        const parsed = await babel.parseAsync(code, getBabelConfig(id))

        const exports: t.Statement[] = []
        babel.traverse(parsed, {
          CallExpression(path) {
            const callee = path.get('callee')
            if (callee.isIdentifier({ name: 'defineStateModule' })) {
              const exportPath = path.findParent(p => p.isExportDeclaration())
              if (exportPath) {
                exports.push(exportPath.node as t.ExportDeclaration)

                // Remove the loader function.
                path.get('arguments')[1].remove()
              } else {
                warn(`defineStateModule call in "${id}" must be exported`)
              }
            }
          },
        })

        const transformer: babel.Visitor = {
          Program(path) {
            path.node.body.push(...exports)
          },
        }

        return babel.transformSync(
          `import { defineStateModule } from "saus/client"`,
          { plugins: [{ visitor: transformer }] }
        ) as { code: string }
      }
    },
  }
}
