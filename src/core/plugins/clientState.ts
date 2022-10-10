import { babel, getBabelConfig, NodePath, resolveReferences, t } from '../babel'
import { SourceMap } from '../node/sourceMap'
import { Plugin } from '../vite'

const includeRE = /\.m?[tj]sx?$/

/**
 * Transform `defineStateModule` calls for client-side use.
 */
export function clientStatePlugin(): Plugin {
  return {
    name: 'saus:state:client',
    enforce: 'pre',
    async transform(code, id, opts) {
      if (opts?.ssr) {
        return
      }
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

        resolveReferences(Array.from(preserved)).forEach(path => {
          preserved.add(path)
        })

        const transformer: babel.Visitor = {
          Program(path) {
            const stmts = new Set(
              Array.from(preserved).sort(
                (a, b) => a.node.start! - b.node.start!
              )
            )

            for (const stmt of stmts) {
              path.node.body.push(stmt.node)
            }
          },
        }

        const transformed = babel.transformSync('', {
          plugins: [{ visitor: transformer }],
          sourceMaps: true,
        }) as {
          code: string
          map: SourceMap
        }

        transformed.map.sources = [id]
        transformed.map.sourcesContent = [code]

        return transformed
      }
    },
  }
}
