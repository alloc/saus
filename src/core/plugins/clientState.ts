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

        const syntaxErr = (msg: string, node: t.Node) => {
          const { start } = node.loc!
          return SyntaxError(`${id}:${start.line}:${start.column} ${msg}`)
        }

        babel.traverse(parsed, {
          ExportDeclaration(path) {
            preserved.add(path)
          },
          CallExpression(path) {
            const callee = path.get('callee')
            if (callee.isIdentifier({ name: 'defineStateModule' })) {
              const args = path.get('arguments')
              if (args[1].isObjectExpression()) {
                // Remove the `serve` method.
                for (const prop of args[1].get('properties')) {
                  if (prop.isSpreadElement()) {
                    throw syntaxErr(
                      'Spread syntax is not allowed in StateModule config',
                      prop.node
                    )
                  }
                  const key = prop.get('key') as NodePath<t.Expression>
                  if (!key.isIdentifier()) {
                    throw syntaxErr(
                      'Only non-computed keys are allowed in StateModule config',
                      key.node
                    )
                  }
                  if (key.node.name == 'serve') {
                    prop.remove()
                  }
                }
              } else {
                // Remove all arguments except the first.
                for (let i = 1; i < args.length; i++) {
                  args[i].remove()
                }
              }
            } else if (callee.toString().endsWith('.onLoad')) {
              const onLoadStmt = path.getStatementParent()!
              preserved.add(onLoadStmt)
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
