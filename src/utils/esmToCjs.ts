import { MagicString, NodePath, t } from '../babel'
import createDebug from 'debug'

const debug = createDebug('saus:commonjs')

const exportKeyword = 'export'

/**
 * Rewrite exports to CommonJS.
 */
export function esmExportsToCjs(
  program: NodePath<t.Program>,
  editor: MagicString
) {
  for (const path of program.get('body')) {
    const start = path.node.start!
    const decl = path.get('declaration') as NodePath<t.Declaration>
    if (path.isExportNamedDeclaration()) {
      const { node } = path
      if (node.source && node.source.value) {
        const code = editor.slice(start, node.end!)
        debug(`Skipping re-export declaration: ${code}`)
        continue
      }
      if (node.specifiers.length) {
        editor.overwrite(
          start,
          node.end!,
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
        // const code = node.specifiers
        //   .map(specifier => {
        //     return `exports.${specifier.exported.name} = ${specifier.local.name};`
        //   })
        //   .join('\n')
        //
        // path.replaceWithMultiple(template.ast(code))
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
          debug(
            `Skipping "export ${kind}" statement due to multiple declarators`
          )
          continue
        }
        const { name } = declarations[0].id as t.Identifier
        // NOTE: `export let` mutability is not preserved.
        editor.overwrite(
          start,
          start + (exportKeyword + ' ' + kind + ' ').length,
          `exports.`
        )
      }
    }
    // else if (path.isExportDefaultDeclaration()) {
    //   const { node } = path
    //   if (decl.isBooleanLiteral()) {
    //     const defaultName = path.scope.generateUid('default')
    //     const defaultDefined = template(`const %%default%% = %%target%%`)({
    //       default: t.identifier(defaultName),
    //       target: node.declaration,
    //     })
    //
    //     path.replaceWith(defaultDefined)
    //     path.insertAfter(template.ast(`module.exports = ${defaultName};`))
    //   } else if (decl.isFunctionDeclaration() || decl.isClassDeclaration()) {
    //     let defaultName = path.scope.generateUid('default')
    //     const funcDeclaration = node.declaration
    //     if (funcDeclaration.id) {
    //       defaultName = funcDeclaration.id.name
    //     } else {
    //       funcDeclaration.id = t.identifier(defaultName)
    //     }
    //     path.replaceWith(funcDeclaration)
    //     path.insertAfter(template.ast(`module.exports = ${defaultName};`))
    //   } else if (
    //     decl.isCallExpression() ||
    //     decl.isNewExpression() ||
    //     decl.isObjectExpression()
    //   ) {
    //     let defaultName = path.scope.generateUid('default')
    //
    //     const defaultDefined = template(`const %%default%% = %%target%%`)({
    //       default: t.identifier(defaultName),
    //       target: node.declaration,
    //     })
    //
    //     path.replaceWith(defaultDefined)
    //     path.insertAfter(template.ast(`module.exports = ${defaultName};`))
    //   } else if (decl.isIdentifier()) {
    //     let defaultName = path.scope.generateUid('default')
    //     path.replaceWith(
    //       template.ast(`const ${defaultName} = ${node.declaration.name}`)
    //     )
    //     path.insertAfter(template.ast(`module.exports = ${defaultName};`))
    //   } else {
    //     throw new Error(`Not support declaration type: ${declarationType}`)
    //   }
    // }
  }
}
