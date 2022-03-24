import { warn } from 'misty'
import { babel, getBabelConfig, t } from '../babel'
import { Plugin } from '../core/vite'

const includeRE = /\.m?[tj]sx?$/

/**
 * Transform `defineStateModule` calls for client-side use.
 */
export function transformClientState(): Plugin {
  let stateModulesByFile: Record<string, string[]>

  return {
    name: 'saus:transformClientState',
    enforce: 'pre',
    saus(context) {
      stateModulesByFile = context.stateModulesByFile
    },
    async transform(code, id, opts) {
      if (opts?.ssr) {
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

        const stateModuleIds: string[] = (stateModulesByFile[id] = [])
        const exports = new Set<t.Statement>()

        babel.traverse(parsed, {
          CallExpression(path) {
            const callee = path.get('callee')
            if (callee.isIdentifier({ name: 'defineStateModule' })) {
              const exportPath = path.findParent(p => p.isExportDeclaration())
              if (exportPath) {
                exports.add(exportPath.node as t.ExportDeclaration)

                const args = path.get('arguments')
                stateModuleIds.push((args[0].node as t.StringLiteral).value)

                // Remove all arguments except the first.
                for (let i = 1; i < args.length; i++) {
                  args[i].remove()
                }
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
