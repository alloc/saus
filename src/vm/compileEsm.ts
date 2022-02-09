import * as esModuleLexer from 'es-module-lexer'
import { basename } from 'path'
import { getBabelProgram, MagicString, NodePath, t } from '../babel'
import {
  __exportAll,
  __exportLet,
  __importDefault,
  __importStar,
} from '../utils/esmInterop'
import { ResolveIdHook } from './types'

type Binding = { referencePaths: NodePath[] }
type BindingMap = Map<Binding, string>

export const exportsId = '__exports'
export const importMetaId = '__importMeta'
export const importAsyncId = '__importAsync'
export const requireAsyncId = '__requireAsync'

export async function compileEsm({
  code,
  filename,
  esmHelpers,
  keepImportMeta,
  resolveId,
}: {
  code: string
  filename: string
  esmHelpers: Set<Function>
  keepImportMeta?: boolean
  resolveId?: ResolveIdHook
}): Promise<MagicString> {
  const ast = getBabelProgram(code, filename)
  const editor = new MagicString(code)

  // Rewrite async imports and import.meta access
  for (const imp of esModuleLexer.parse(code)[0]) {
    if (imp.d >= 0) {
      editor.overwrite(imp.ss, imp.s - 1, importAsyncId)
      if (imp.n && resolveId) {
        const resolvedId = await resolveId(imp.n, filename, true)
        if (resolvedId) {
          editor.overwrite(imp.s, imp.e, JSON.stringify(resolvedId))
        }
      }
    } else if (!keepImportMeta && imp.d == -2) {
      editor.overwrite(imp.s, imp.e, importMetaId)
    }
  }

  const importedBindings: BindingMap = new Map()

  async function resolveStaticImport(node: any, importer: string) {
    let source: string = node.source?.value
    if (source !== undefined && resolveId) {
      const resolvedId = await resolveId(source, importer, false)
      if (resolvedId) {
        source = resolvedId
      }
    }
    return source
  }

  let hoistIndex = 0
  for (const path of ast.get('body')) {
    if (path.isExportDeclaration()) {
      const source = await resolveStaticImport(path.node, filename)
      rewriteExport(path, source, editor, esmHelpers)
    } else if (path.isImportDeclaration()) {
      const source = await resolveStaticImport(path.node, filename)
      hoistIndex = rewriteImport(
        path,
        source,
        editor,
        importedBindings,
        esmHelpers,
        hoistIndex
      )
    }
  }

  // Rewrite any references to imported bindings.
  for (const [{ referencePaths }, binding] of importedBindings) {
    for (const path of referencePaths) {
      const parent = path.parentPath!
      const grandParent = parent.parentPath!

      // Convert shorthand property in object expression.
      if (
        grandParent.isObjectExpression() &&
        parent.isObjectProperty() &&
        parent.node.shorthand
      ) {
        editor.appendLeft(path.node.end!, `: ${binding}`)
      }

      // Convert super class identifier.
      else if (parent.isClassDeclaration() && path.parentKey == 'superClass') {
        const blockParent = parent.findParent(parent =>
          parent.isBlockStatement()
        )
        if (blockParent) {
          const tempId = parent.scope.generateDeclaredUidIdentifier(
            (path.node as t.Identifier).name
          )
          const { body } = blockParent.node as t.BlockStatement
          editor.prependRight(body[0].start!, `const ${tempId} = ${binding};\n`)
        }
      }

      // Convert simple identifier.
      else {
        editor.overwrite(path.node.start!, path.node.end!, binding)
      }
    }
  }

  return editor
}

function rewriteImport(
  path: NodePath<t.ImportDeclaration>,
  source: string,
  editor: MagicString,
  bindings: BindingMap,
  esmHelpers: Set<Function>,
  hoistIndex: number
) {
  const { start, end } = path.node as {
    start: number
    end: number
  }
  const requireCalls = generateRequireCalls(path, source, bindings, esmHelpers)
  if (start !== hoistIndex) {
    editor.remove(start, end + 1)
    editor.appendRight(hoistIndex, requireCalls)
  } else {
    editor.overwrite(start, end + 1, requireCalls)
    hoistIndex = end + 1
  }
  return hoistIndex
}

const awaitRequire = (source: string) => `await ${requireAsyncId}("${source}")`

function rewriteExport(
  path: NodePath<t.ExportDeclaration>,
  source: string | undefined,
  editor: MagicString,
  esmHelpers: Set<Function>
) {
  const { start, end } = path.node as {
    start: number
    end: number
  }
  const decl = path.get('declaration') as NodePath<t.Declaration>
  if (path.isExportNamedDeclaration()) {
    const { node } = path
    if (source) {
      const requireCall = awaitRequire(source)
      if (t.isExportNamespaceSpecifier(node.specifiers[0])) {
        const { name } = node.specifiers[0].exported
        editor.overwrite(start, end, `${exportsId}.${name} = ${requireCall}`)
      } else {
        const required = path.scope.generateUid()
        editor.overwrite(start, end, `const ${required} = ${requireCall}`)
        for (const spec of node.specifiers as t.ExportSpecifier[]) {
          const property = t.isStringLiteral(spec.exported)
            ? `["${spec.exported.value.replace(/"/g, '\\"')}"]`
            : `.${spec.exported.name}`

          editor.appendLeft(
            end,
            `\n${exportsId}.${spec.local.name} = ${required}${property}`
          )
        }
      }
    } else if (node.specifiers.length) {
      const exported: string[] = []
      for (const spec of node.specifiers) {
        if (!t.isExportSpecifier(spec)) {
          continue
        }
        const assignee = t.isStringLiteral(spec.exported)
          ? `${exportsId}["${spec.exported.value.replace(/"/g, '\\"')}"]`
          : `${exportsId}.${spec.exported.name}`
        exported.push(`${assignee} = ${spec.local.name}`)
      }
      editor.overwrite(start, end, exported.join('\n'))
    } else if (decl.isFunctionDeclaration() || decl.isClassDeclaration()) {
      const { name } = decl.node.id!
      editor.remove(start, start + `export `.length)
      editor.appendLeft(end, `\n${exportsId}.${name} = ${name};`)
    } else if (decl.isVariableDeclaration()) {
      const { kind, declarations } = decl.node
      if (declarations.length > 1) {
        throw Error(
          `Multiple declarators in "export ${kind}" statement is unsupported`
        )
      }
      const { name } = declarations[0].id as t.Identifier
      editor.remove(start, start + `export `.length)
      if (kind == 'const') {
        editor.appendLeft(end, `\n${exportsId}.${name} = ${name};`)
      } else {
        esmHelpers.add(__exportLet)
        editor.appendLeft(
          end,
          `\n__exportLet(${exportsId}, "${name}", () => ${name});`
        )
      }
    }
  } else if (source && path.isExportAllDeclaration()) {
    editor.overwrite(
      start,
      end,
      `__exportAll(${exportsId}, ${awaitRequire(source)})`
    )
    esmHelpers.add(__exportAll)
  } else if (path.isExportDefaultDeclaration()) {
    editor.overwrite(
      start,
      start + `export default`.length,
      `${exportsId}.default =`
    )
  }
}

export function generateRequireCalls(
  path: NodePath<t.ImportDeclaration>,
  source: string,
  bindings: BindingMap,
  esmHelpers: Set<Function>
) {
  const requireCall = awaitRequire(source)

  const specifiers = path.get('specifiers')
  if (!specifiers.length) {
    return `${requireCall};\n`
  }

  // Assume that circular imports are highly unlikely for bare imports
  // unless they start with "@/" (a common alias for local files).
  // This assumption lets us destructure import bindings statically
  // for a nicer debugging experience by avoiding generated variables.
  const assumeStaticBinding = /^(\w|@\w)/.test(source)

  let aliasRoot: string | undefined
  let requireCalls = ''
  let staticBindings: [alias: string, imported: string][] = []

  for (const spec of specifiers) {
    const alias = spec.node.local.name
    if (spec.isImportNamespaceSpecifier()) {
      requireCalls += `const ${alias} = __importStar(${requireCall});\n`
      esmHelpers.add(__importStar)
    } else if (spec.isImportDefaultSpecifier()) {
      const binding = spec.scope.getBinding(alias)
      if (!binding) {
        throw Error('Binding not found')
      }
      if (!assumeStaticBinding) {
        bindings.set(binding, alias + '.default')
      }
      const staticBinding = assumeStaticBinding ? '.default' : ''
      const imported = `__importDefault(${requireCall})${staticBinding}`
      requireCalls += `const ${alias} = ${imported};\n`
      esmHelpers.add(__importDefault)
    } else if (spec.isImportSpecifier()) {
      const binding = spec.scope.getBinding(alias)
      if (!binding) {
        throw Error('Binding not found')
      }

      const { imported } = spec.node

      // Import bindings with top-level references can be destructured
      // immediately, which allows for a nicer debugging experience.
      const canBindStatically =
        t.isIdentifier(imported) &&
        (assumeStaticBinding ||
          binding.referencePaths.some(path => {
            const nearestScope = path.findParent(isScopable)!
            if (nearestScope.isProgram()) {
              return true
            }
          }))

      if (canBindStatically) {
        staticBindings.push([alias, imported.name])
      } else {
        aliasRoot ||= path.scope.generateUid(basename(source))
        bindings.set(
          binding,
          t.isIdentifier(imported)
            ? aliasRoot + '.' + imported.name
            : aliasRoot + `["${imported.value}"]`
        )
      }
    }
  }

  if (aliasRoot) {
    const declarators = staticBindings
      .map(([alias, imported]) => `, ${alias} = ${aliasRoot}.${imported}`)
      .join('')

    requireCalls += `const ${aliasRoot} = ${requireCall}${declarators};\n`
  } else if (staticBindings.length) {
    const declarators = staticBindings
      .map(([alias, imported]) =>
        alias == imported ? imported : `${imported}: ${alias}`
      )
      .join(', ')

    requireCalls += `const { ${declarators} } = ${requireCall};\n`
  }

  return requireCalls
}

function isScopable(path: NodePath) {
  return path.isScopable()
}
