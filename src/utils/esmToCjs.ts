import { MagicString, NodePath, t } from '../babel'
import createDebug from 'debug'

const debug = createDebug('saus:commonjs')

const exportKeyword = 'export'

/**
 * Rewrite exports to CommonJS.
 */
export function esmExportsToCjs(
  program: NodePath<t.Program>,
  editor: MagicString,
  requireId = 'require'
) {
  for (const path of program.get('body')) {
    if (!path.isExportDeclaration()) {
      continue
    }
    const { start, end } = path.node as {
      start: number
      end: number
    }
    const decl = path.get('declaration') as NodePath<t.Declaration>
    if (path.isExportNamedDeclaration()) {
      const { node } = path
      if (node.source) {
        const requireCall = `${requireId}("${node.source.value}")`
        if (t.isExportNamespaceSpecifier(node.specifiers[0])) {
          const { name } = node.specifiers[0].exported
          editor.overwrite(start, end, `exports.${name} = ${requireCall}`)
        } else {
          const required = program.scope.generateUid()
          editor.overwrite(start, end, `const ${required} = ${requireCall}`)
          for (const spec of node.specifiers as t.ExportSpecifier[]) {
            const property = t.isStringLiteral(spec.exported)
              ? `["${spec.exported.value.replace(/"/g, '\\"')}"]`
              : `.${spec.exported.name}`

            editor.appendLeft(
              end,
              `\nexports.${spec.local.name} = ${required}${property}`
            )
          }
        }
      } else if (node.specifiers.length) {
        editor.overwrite(
          start,
          end,
          node.specifiers
            .map(spec =>
              t.isExportSpecifier(spec)
                ? (t.isStringLiteral(spec.exported)
                    ? `exports["${spec.exported.value.replace(/"/g, '\\"')}"]`
                    : `exports.${spec.exported.name}`) + ` = ${spec.local.name}`
                : false
            )
            .filter(Boolean)
            .join('\n')
        )
      } else if (decl.isFunctionDeclaration() || decl.isClassDeclaration()) {
        const { name } = decl.node.id!
        editor.overwrite(
          start,
          start + exportKeyword.length,
          `exports.${name} =`
        )
      } else if (decl.isVariableDeclaration()) {
        const { kind, declarations } = decl.node
        if (declarations.length > 1) {
          throw Error(
            `Multiple declarators in "export ${kind}" statement is unsupported`
          )
        }
        editor.overwrite(start, start + `export ${kind} `.length, `exports.`)
      }
    } else if (path.isExportAllDeclaration()) {
      const { node } = path
      const requireCall = `${requireId}("${node.source.value}")`
      editor.overwrite(
        start,
        end,
        // The `default` export is not set by `export *` statements.
        `Object.assign(exports, ${requireCall}, {default: exports.default})`
      )
    } else if (path.isExportDefaultDeclaration()) {
      editor.overwrite(
        start,
        start + `export default `.length,
        `exports.default = `
      )
    }
  }
}
