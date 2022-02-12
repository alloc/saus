import * as esModuleLexer from 'es-module-lexer'
import { basename } from 'path'
import { getBabelProgram, MagicString, NodePath, t } from '../babel'
import {
  __exportAll,
  __exportLet,
  __importDefault,
  __importAll,
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
  keepImportCalls,
  keepImportMeta,
  resolveId,
}: {
  code: string
  filename: string
  esmHelpers: Set<Function>
  keepImportCalls?: boolean
  keepImportMeta?: boolean
  resolveId?: ResolveIdHook
}): Promise<MagicString> {
  const ast = getBabelProgram(code, filename)
  const editor = new MagicString(code)

  // Rewrite async imports and import.meta access
  if (!keepImportCalls || !keepImportMeta)
    for (const imp of esModuleLexer.parse(code)[0]) {
      if (!keepImportCalls && imp.d >= 0) {
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

  async function resolveStaticImport(
    node: any,
    importer: string
  ): Promise<ImportDescription | undefined> {
    let source: string = node.source?.value
    if (source !== undefined) {
      let skip = false
      if (resolveId) {
        const resolvedId = await resolveId(source, importer, false)
        if (resolvedId) {
          source = resolvedId
        } else if (resolvedId == '') {
          skip = true
        }
      }
      return { source, skip }
    }
  }

  let hoistIndex = 0
  for (const path of ast.get('body')) {
    if (path.isExportDeclaration()) {
      const imported = await resolveStaticImport(path.node, filename)
      if (imported?.skip) {
        injectAliasedImport(path, imported, editor)
      }
      rewriteExport(path, imported, importedBindings, editor, esmHelpers)
    } else if (path.isImportDeclaration()) {
      const imported = (await resolveStaticImport(path.node, filename))!
      if (imported.skip) {
        const { start, end } = path.node as {
          start: number
          end: number
        }
        editor.remove(start, end + 1)
        editor.prepend(code.slice(start, end + 1))
      } else {
        hoistIndex = rewriteImport(
          path,
          imported.source,
          editor,
          importedBindings,
          esmHelpers,
          hoistIndex
        )
      }
    }
  }

  // Rewrite any references to imported bindings.
  for (const [{ referencePaths }, binding] of importedBindings) {
    for (const path of referencePaths) {
      // Skip exported references as those are already rewritten.
      if (path.findParent(parent => parent.isExportDeclaration())) {
        continue
      }
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
          ).name
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

type ImportDescription = {
  source: string
  /**
   * When true, skip transformation of this import and hoist it.
   */
  skip: boolean
  /**
   * If an alias exists, use it instead of `awaitRequire(source)`.
   */
  alias?: string
  /**
   * Use these aliases instead of a local namespace.
   */
  aliasMap?: Record<string, string>
}

function injectAliasedImport(
  path: NodePath<t.ExportDeclaration>,
  imported: ImportDescription,
  editor: MagicString
) {
  const { node } = path
  const specs = t.isExportNamedDeclaration(node) ? node.specifiers : []
  if (
    t.isExportAllDeclaration(node) ||
    t.isExportNamespaceSpecifier(specs[0])
  ) {
    imported.alias = path.scope.generateUid(basename(imported.source))
    editor.prepend(`import * as ${imported.alias} from "${imported.source}"`)
  } else {
    const declarators: string[] = []
    imported.aliasMap = {}
    for (const { local } of specs as t.ExportSpecifier[]) {
      const alias = path.scope.generateUid(local.name)
      declarators.push(`${local.name} as ${alias}`)
      imported.aliasMap[local.name] = alias
    }
    editor.prepend(
      `import { ${declarators.join(', ')} } from "${imported.source}"`
    )
  }
}

const awaitRequire = (source: string) => `await ${requireAsyncId}("${source}")`

function rewriteExport(
  path: NodePath<t.ExportDeclaration>,
  imported: ImportDescription | undefined,
  bindings: BindingMap,
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
    if (imported) {
      if (t.isExportNamespaceSpecifier(node.specifiers[0])) {
        const { name } = node.specifiers[0].exported
        const fromExpr = imported.alias || awaitRequire(imported.source)
        editor.overwrite(start, end, `${exportsId}.${name} = ${fromExpr}`)
      } else {
        // An alias map is defined when the caller wants to use identifiers
        // declared by an uncompiled import declaration. Otherwise, we need
        // to cache the `awaitRequire` expression for future reference.
        const alias =
          !imported.aliasMap &&
          path.scope.generateUid(basename(imported.source))

        if (alias) {
          editor.overwrite(
            start,
            end,
            `const ${alias} = ${awaitRequire(imported.source)}`
          )
        } else {
          // An import declaration was prepended to the file.
          editor.remove(start, end + 1)
        }

        for (const spec of node.specifiers as t.ExportSpecifier[]) {
          const exported = t.isStringLiteral(spec.exported)
            ? `["${spec.exported.value.replace(/"/g, '\\"')}"]`
            : `.${spec.exported.name}`

          const local = alias
            ? `${alias}.${spec.local.name}`
            : imported.aliasMap![spec.local.name]

          editor.appendLeft(end, `\n${exportsId}${exported} = ${local}`)
        }
      }
    } else if (node.specifiers.length) {
      const exported: string[] = []
      const specPaths = path.get('specifiers') as NodePath<t.ExportSpecifier>[]
      node.specifiers.forEach((spec, i) => {
        if (!t.isExportSpecifier(spec)) {
          return
        }

        const specPath = specPaths[i]
        const binding = specPath.scope.getBinding(spec.local.name)
        if (!binding) {
          return
        }

        let needsLiveBinding = false
        if (
          !binding.path.isImportDefaultSpecifier() &&
          !binding.path.isImportNamespaceSpecifier()
        ) {
          const varDecl = binding.path.findParent(parent =>
            parent.isVariableDeclaration()
          ) as NodePath<t.VariableDeclaration>
          needsLiveBinding = !varDecl || varDecl.node.kind !== 'const'
        }

        const local = bindings.get(binding) || spec.local.name

        let property: string
        let assignee: string | undefined

        if (t.isStringLiteral(spec.exported)) {
          property = spec.exported.value.replace(/"/g, '\\"')
          if (!needsLiveBinding) {
            assignee = `${exportsId}["${property}"]`
          }
        } else {
          property = spec.exported.name
          if (!needsLiveBinding) {
            assignee = `${exportsId}.${property}`
          }
        }

        exported.push(
          assignee
            ? `${assignee} = ${local}`
            : `__exportLet(${exportsId}, "${property}", () => ${local})`
        )
        if (needsLiveBinding) {
          esmHelpers.add(__exportLet)
        }
      })
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
  } else if (imported && path.isExportAllDeclaration()) {
    const fromExpr = imported.alias || awaitRequire(imported.source)
    editor.overwrite(start, end, `__exportAll(${exportsId}, ${fromExpr})`)
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
      requireCalls += `const ${alias} = __importAll(${requireCall});\n`
      esmHelpers.add(__importAll)
    } else if (spec.isImportDefaultSpecifier()) {
      const binding = spec.scope.getBinding(alias)
      if (!binding) {
        throw Error('Binding not found')
      }
      const imported = `__importDefault(${requireCall})`
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
        !isExported(binding) &&
        (assumeStaticBinding || usedInProgramScope(binding))

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

function isExported(binding: Binding) {
  return binding.referencePaths.some(path =>
    path.findParent(parent => parent.isExportNamedDeclaration())
  )
}

function usedInProgramScope(binding: Binding) {
  return binding.referencePaths.some(path =>
    path.findParent(parent => parent.isScopable())!.isProgram()
  )
}
