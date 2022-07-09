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
    configResolved({ mode }) {
      const isProduction = mode == 'production'

      this.transform = (code, id, opts) => {
        if (opts?.ssr) {
          return
        }
        if (includeRE.test(id) && layoutExport.test(code)) {
          let clientRefs: NodePath<t.Statement>[] | undefined
          let layoutConfig: NodePath<t.ObjectExpression>

          // Prepare the `defineLayout` call for client-side use.
          const cleanDefaultExport = (
            decl: NodePath<t.ExportDefaultDeclaration>
          ) => {
            const call = decl.get('declaration') as NodePath<t.CallExpression>
            const configArg = (layoutConfig = call.get(
              'arguments'
            )[0] as NodePath<t.ObjectExpression>)

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

              const clientImports = ['defineLayout']
              if (!isProduction && injectErrorPageHook(layoutConfig)) {
                clientImports.push('renderErrorPage')
              }

              // Inject "defineLayout" import from saus/client
              prog.node.body.unshift(
                t.importDeclaration(
                  clientImports.map(name =>
                    t.importSpecifier(t.identifier(name), t.identifier(name))
                  ),
                  t.stringLiteral('saus/client')
                )
              )
            },
          }

          return transformSync(code, id, [{ visitor }]) as vite.TransformResult
        }
      }
    },
  }
}

function getPropertyKey(prop: NodePath) {
  const key = prop.get('key') as NodePath
  return key.isIdentifier() ? key.node.name : ''
}

const clientHooksId = 'clientHooks'
const errorPageHookId = 'renderErrorPage'

function injectErrorPageHook(layoutConfig: NodePath<t.ObjectExpression>) {
  let clientHooksProp = layoutConfig
    .get('properties')
    .find(prop => getPropertyKey(prop) == clientHooksId)

  if (!clientHooksProp) {
    layoutConfig.node.properties.push(
      t.objectProperty(
        t.identifier(clientHooksId),
        t.objectExpression([
          t.objectProperty(
            t.identifier(errorPageHookId),
            t.identifier('renderErrorPage')
          ),
        ])
      )
    )
    return true
  }

  const clientHooks =
    (clientHooksProp.isObjectProperty() && clientHooksProp.get('value')) || null

  if (clientHooks?.isObjectExpression()) {
    const errorPageHook = clientHooks
      .get('properties')
      .find(prop => getPropertyKey(prop) == errorPageHookId)

    if (!errorPageHook) {
      clientHooks.node.properties.push(
        t.objectProperty(
          t.identifier(errorPageHookId),
          t.identifier('renderErrorPage')
        )
      )
      return true
    }
  }
}
