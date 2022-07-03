import { babel, NodePath, resolveReferences, t, transformSync } from '@/babel'
import { vite } from '@/vite'

const includeRE = /\.m?[tj]sx?$/
const layoutExport = /\bexport default defineLayout\b/

/**
 * Transform `defineLayout` calls for client-side use.
 */
export function clientLayoutPlugin(): vite.Plugin {
  return {
    name: 'saus:layout:client',
    enforce: 'pre',
    transform(code, id, opts) {
      if (opts?.ssr) {
        return
      }
      if (includeRE.test(id) && layoutExport.test(code)) {
        let clientRefs: NodePath<t.Statement>[] | undefined

        // Prepare the `defineLayout` call for client-side use.
        const cleanDefaultExport = (
          decl: NodePath<t.ExportDefaultDeclaration>
        ) => {
          const call = decl.get('declaration') as NodePath<t.CallExpression>
          const configArg = call.get(
            'arguments'
          )[0] as NodePath<t.ObjectExpression>

          const clientProps: NodePath[] = []
          for (const prop of configArg.get('properties')) {
            const key = prop.get('key') as NodePath
            const rawKey = key.isIdentifier() ? key.node.name : null

            if (rawKey == 'render' || rawKey == 'clientHooks') {
              clientProps.push(prop)
            } else {
              prop.remove()
            }
          }

          if (clientProps.length)
            clientRefs = resolveReferences(
              clientProps,
              path => !clientProps.some(prop => prop.isAncestor(path))
            )
        }

        const visitor: babel.Visitor = {
          Program(prog) {
            const defaultExport = prog
              .get('body')
              .find(stmt => stmt.isExportDefaultDeclaration())!

            cleanDefaultExport(defaultExport as any)
            if (!clientRefs) {
              return
            }

            for (const stmt of prog.get('body')) {
              if (stmt == defaultExport) {
                continue
              }
              // Remove statements not used in render method
              if (!clientRefs.includes(stmt)) {
                stmt.remove()
              }
              // Remove original "defineLayout" import
              else if (stmt.isImportDeclaration()) {
                for (const spec of stmt.get('specifiers')) {
                  const localId = spec.isImportSpecifier()
                    ? spec.get('local')
                    : null

                  if (localId?.isIdentifier({ name: 'defineLayout' })) {
                    spec.remove()
                  }
                }
              }
            }

            // Inject "defineLayout" import from saus/client
            prog.node.body.unshift(
              t.importDeclaration(
                [
                  t.importSpecifier(
                    t.identifier('defineLayout'),
                    t.identifier('defineLayout')
                  ),
                ],
                t.stringLiteral('saus/client')
              )
            )
          },
        }

        return transformSync(code, id, [{ visitor }]) as vite.TransformResult
      }
    },
  }
}
