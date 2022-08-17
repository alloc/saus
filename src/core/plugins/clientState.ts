import { babel, getBabelConfig, NodePath, resolveReferences, t } from '../babel'
import { Plugin } from '../vite'

const includeRE = /\.m?[tj]sx?$/

/**
 * Transform `defineStateModule` calls for client-side use.
 */
export function clientStatePlugin(): Plugin {
  let stateModulesByFile: Record<string, string[]>

  return {
    name: 'saus:state:client',
    enforce: 'pre',
    saus(context) {
      stateModulesByFile = context.stateModulesByFile
    },
    async transform(code, id, opts) {
      if (!includeRE.test(id)) {
        return // Unsupported file type
      }
      if (id.includes('/saus/src/')) {
        return // Saus core modules
      }
      if (/\bdefineStateModule\b/.test(code)) {
        const parsed = await babel.parseAsync(code, getBabelConfig(id))
        if (!parsed) {
          return
        }

        // For SSR, just extract the state module IDs for hot reload purposes.
        if (opts?.ssr) {
          const stateModuleIds: string[] = (stateModulesByFile[id] = [])
          babel.traverse(parsed, {
            CallExpression(path) {
              const callee = path.get('callee')
              if (callee.isIdentifier({ name: 'defineStateModule' })) {
                const args = path.get('arguments')
                stateModuleIds.push((args[0].node as t.StringLiteral).value)
              }
            },
          })
        } else {
          const preserved = new Set<NodePath<t.Statement>>()

          babel.traverse(parsed, {
            ExportDeclaration(path) {
              preserved.add(path)
            },
            CallExpression(path) {
              const callee = path.get('callee')
              if (callee.isIdentifier({ name: 'defineStateModule' })) {
                const args = path.get('arguments')
                for (let i = 1; i < args.length; i++) {
                  // Remove all arguments except the first.
                  args[i].remove()
                }
              }
              // FIXME: Be smarter about which onLoad calls we preserve.
              else if (callee.toString().endsWith('.onLoad')) {
                preserved.add(path.getStatementParent()!)
                path.skip()
              }
            },
          })

          const transformer: babel.Visitor = {
            Program(path) {
              const stmts = new Set(
                Array.from(preserved)
                  .concat(resolveReferences(Array.from(preserved)))
                  .sort((a, b) => a.node.start! - b.node.start!)
              )

              for (const stmt of stmts) {
                path.node.body.push(stmt.node)
              }
            },
          }

          return babel.transformSync('', {
            plugins: [{ visitor: transformer }],
          }) as { code: string }
        }
      }
    },
  }
}
