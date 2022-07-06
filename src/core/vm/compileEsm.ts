import * as esModuleLexer from 'es-module-lexer'
import { basename, extname } from 'path'
import { getBabelProgram, MagicString, NodePath, t } from '../babel'
import {
  __exportAll,
  __exportLet,
  __importAll,
  __importDefault,
} from '../node/esmInterop'
import { SourceMap } from '../node/sourceMap'
import { vite } from '../vite'
import { ForceLazyBindingHook } from './types'

type Binding = { path: NodePath; referencePaths: NodePath[] }
type BindingMap = Map<Binding, string>

export const exportsId = '__exports'
export const importMetaId = '__importMeta'
export const importAsyncId = '__importAsync'
export const requireAsyncId = '__requireAsync'

export type CompiledEsm = MagicString & { hoistIndex: number }

export type EsmCompilerOptions = {
  code: string
  filename: string
  /** Mutated by `compileEsm` when an imported module directly affects the exported values of this module. */
  hotLinks?: Set<string>
  /** Mutated by `compileEsm` when a helper function is required. */
  esmHelpers: Set<Function>
  keepImportCalls?: boolean
  keepImportMeta?: boolean
  forceLazyBinding?: ForceLazyBindingHook
  resolveId?: (
    id: string,
    importer?: string | null,
    isDynamic?: boolean
  ) => Promise<string>
}

export async function compileEsm({
  code,
  filename,
  hotLinks,
  esmHelpers,
  keepImportCalls,
  keepImportMeta,
  forceLazyBinding,
  resolveId,
}: EsmCompilerOptions) {
  const ast = getBabelProgram(code, filename)
  let editor = new MagicString(code)

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

  const forceLazy = forceLazyBinding
    ? (imported: string[], source: string) =>
        forceLazyBinding(imported, source, filename)
    : () => true

  let hoistIndex = 0
  const preservedImports = new Set<NodePath>()
  const resolvedImports = new Map<NodePath, ImportDescription>()

  // 1. Remove all import and export statements
  for (const path of ast.get('body')) {
    if (path.isImportDeclaration() || path.isExportDeclaration()) {
      const imported = await resolveStaticImport(path.node, filename)

      if (imported) {
        if (!imported.skip) {
          resolvedImports.set(path, imported)
        } else if (path.isImportDeclaration()) {
          preservedImports.add(path)
          continue
        }
      }

      let { start, end } = path.node as {
        start: number
        end: number
      }

      if (path.isExportNamedDeclaration() && path.node.declaration) {
        end = start + kExportKeyword.length + 1
      } else if (path.isExportDefaultDeclaration()) {
        end = start + kExportDefault.length + 1
      } else {
        end = Math.min(end + 1, code.length)
      }

      editor.remove(start, end)

      if (imported?.skip && path.isExportDeclaration()) {
        preservedImports.add(path)
        injectAliasedImport(path, imported, editor)
      }
    }
  }

  // 2. Rewrite all import statements, hoisting them together.
  for (const path of ast.get('body')) {
    if (path.isImportDeclaration()) {
      if (preservedImports.has(path)) {
        continue
      }
      const imported = resolvedImports.get(path)!
      hoistIndex = rewriteImport(
        hoistIndex,
        path,
        imported.source,
        editor,
        importedBindings,
        esmHelpers,
        forceLazy
      )
    }
  }

  // 3. Rewrite all export statements
  for (const path of ast.get('body')) {
    if (path.isExportDeclaration()) {
      if (preservedImports.has(path)) {
        continue
      }
      const imported = resolvedImports.get(path)!
      rewriteExport(
        path,
        imported,
        importedBindings,
        editor,
        esmHelpers,
        forceLazy
      )
    }
  }

  // 4. Rewrite any references to imported bindings
  for (const [{ referencePaths }, binding] of importedBindings) {
    for (const path of referencePaths) {
      const parent = path.parentPath!

      // Top-level references create a hot link to the
      // imported module.
      if (hotLinks && isTopLevelReference(path)) {
        const id = path.toString()
        const source = (
          path.scope.getBinding(id)!.path.parentPath!
            .node as t.ImportDeclaration
        ).source.value

        hotLinks.add(source)
      }

      // Skip exported references as those are already rewritten.
      if (parent.isExportSpecifier()) {
        continue
      }

      const grandParent = parent.parentPath!

      // Convert shorthand property in object expression.
      if (
        grandParent.isObjectExpression() &&
        parent.isObjectProperty() &&
        parent.node.shorthand
      ) {
        editor.appendLeft(path.node.end!, `: ${binding}`)
      }

      // Convert simple identifier.
      else {
        editor.overwrite(path.node.start!, path.node.end!, binding)
      }
    }
  }

  // Reset the hoist index, since this will represent where
  // the end of the final ESM import is located.
  hoistIndex = 0

  // Hoist any preserved imports above rewritten imports/exports.
  if (preservedImports.size > 0) {
    const map = editor.generateMap({ hires: true })
    code = editor.toString()
    editor = new MagicString(code)
    attachInputSourcemap(editor, map, filename)

    for (const imp of esModuleLexer.parse(code)[0]) {
      if (imp.d !== -1) continue

      const se = findStatementEnd(code, imp.se)
      if (imp.ss !== hoistIndex) {
        editor.move(imp.ss, se, hoistIndex)
      } else {
        hoistIndex = se
      }
    }
  }

  // @ts-ignore
  editor.hoistIndex = hoistIndex

  return editor as CompiledEsm
}

function isTopLevelReference(path: NodePath) {
  const scopedParent = path.findParent(
    parent => parent.isScopable() && !parent.isBlockStatement()
  )!

  if (scopedParent.isProgram()) {
    return true
  }

  // Unsupported detection.
  if (!scopedParent.isFunction()) {
    return false
  }

  let name: string | undefined
  let scope!: import('@babel/traverse').Scope

  if (scopedParent.isFunctionDeclaration() && scopedParent.node.id) {
    name = scopedParent.node.id.name
    scope = scopedParent.scope
  }

  if (!name) {
    const namedParent = scopedParent.findParent(
      parent =>
        parent.isVariableDeclarator() ||
        parent.isObjectExpression() ||
        parent.isArrayExpression()
    ) as NodePath<any> | null

    if (namedParent?.isVariableDeclarator()) {
      const nameNode: t.Node = namedParent.node.id
      if (t.isIdentifier(nameNode)) {
        name = nameNode.name
        scope = namedParent.scope
      }
    }

    // Unsupported detection.
    if (!name) {
      return false
    }
  }

  const binding = scope.getBinding(name)
  if (!binding || !binding.constant) {
    return false
  }

  return binding.referencePaths.some(ref => {
    const refParent = ref.parentPath
    if (refParent?.isCallExpression()) {
      const scopedParent = refParent.findParent(parent => parent.isScopable())!
      return scopedParent.isProgram() || isTopLevelReference(scopedParent)
    }
  })
}

/**
 * Find where the next statement begins.
 *
 * This assumes a single-line statement.
 */
function findStatementEnd(code: string, pos: number) {
  const whitespaceRE = /\s/
  let allowBreakOnSameLine = false
  while (++pos < code.length) {
    const char = code[pos - 1]
    if (char === kReturn) {
      break
    }
    if (whitespaceRE.test(char)) {
      allowBreakOnSameLine = true
    } else if (allowBreakOnSameLine) {
      break
    }
  }
  return pos
}

function attachInputSourcemap(
  editor: MagicString,
  inMap: SourceMap,
  filename: string
) {
  const { generateMap } = editor
  editor.generateMap = function (options) {
    const map = generateMap.call(editor, options)
    return vite.combineSourcemaps(filename, [map as any, inMap as any]) as any
  }
  return editor
}

const kSemi = ';'
const kReturn = '\n'
const kSemiReturn = ';\n'

function rewriteImport(
  hoistIndex: number,
  path: NodePath<t.ImportDeclaration>,
  source: string,
  editor: MagicString,
  bindings: BindingMap,
  esmHelpers: Set<Function>,
  forceLazyBinding: (
    imported: string[],
    source: string
  ) => string[] | boolean | undefined
) {
  const { start, end } = path.node as {
    start: number
    end: number
  }
  const requireCalls = generateRequireCalls(
    path,
    source,
    bindings,
    esmHelpers,
    forceLazyBinding
  )
  editor.appendRight(hoistIndex, requireCalls + kSemiReturn)
  if (start == hoistIndex) {
    hoistIndex = Math.min(end + 1, editor.original.length)
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

function sourceAlias(source: string) {
  return basename(source, extname(source))
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
    imported.alias = path.scope.generateUid(sourceAlias(imported.source))
    editor.prepend(
      `import * as ${imported.alias} from "${imported.source}"` + kSemiReturn
    )
  } else {
    const declarators: string[] = []
    imported.aliasMap = {}
    for (const { local } of specs as t.ExportSpecifier[]) {
      const alias = path.scope.generateUid(local.name)
      declarators.push(`${local.name} as ${alias}`)
      imported.aliasMap[local.name] = alias
    }
    editor.prepend(
      `import { ${declarators.join(', ')} } from "${imported.source}"` +
        kSemiReturn
    )
  }
}

const kExportDefault = 'export default'
const kExportKeyword = 'export'

const awaitRequire = (source: string) => `await ${requireAsyncId}("${source}")`

function rewriteExport(
  path: NodePath<t.ExportDeclaration>,
  imported: ImportDescription | undefined,
  bindings: BindingMap,
  editor: MagicString,
  esmHelpers: Set<Function>,
  forceLazyBinding: (
    imported: string[],
    source: string
  ) => string[] | boolean | undefined
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
        esmHelpers.add(__importAll)
        editor.appendRight(
          start,
          `${exportsId}.${name} = __importAll(${fromExpr})` + kSemiReturn
        )
      } else {
        // An alias map is defined when the caller wants to use identifiers
        // declared by an uncompiled import declaration. Otherwise, we need
        // to cache the `awaitRequire` expression for future reference.
        const alias =
          !imported.aliasMap &&
          path.scope.generateUid(sourceAlias(imported.source))

        if (alias) {
          editor.appendRight(
            start,
            `const ${alias} = ${awaitRequire(imported.source)}` + kSemiReturn
          )
        }

        const lazyBindings = findLazyBindings(
          imported.source,
          path.get('specifiers'),
          forceLazyBinding
        )

        for (const spec of node.specifiers as t.ExportSpecifier[]) {
          const local = alias
            ? `${alias}.${spec.local.name}`
            : imported.aliasMap![spec.local.name]

          const exportStmt = rewriteExportSpecifier(
            local,
            spec.exported,
            !lazyBindings.includes(spec.local.name),
            esmHelpers
          )

          editor.appendRight(start, exportStmt + kSemiReturn)
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

        exported.push(
          rewriteExportSpecifier(
            bindings.get(binding) || spec.local.name,
            spec.exported,
            binding.constant && !bindings.has(binding),
            esmHelpers
          )
        )
      })
      editor.appendRight(start, exported.join(kReturn) + kSemiReturn)
    } else if (decl.isFunctionDeclaration() || decl.isClassDeclaration()) {
      const { name } = decl.node.id!
      editor.appendRight(
        end,
        kReturn + `${exportsId}.${name} = ${name}` + kSemi
      )
    } else if (decl.isVariableDeclaration()) {
      const { kind, declarations } = decl.node
      if (declarations.length > 1) {
        throw Error(
          `Multiple declarators in "export ${kind}" statement is unsupported`
        )
      }
      const { name } = declarations[0].id as t.Identifier
      let compiled: string
      if (kind == 'const') {
        compiled = `${exportsId}.${name} = ${name}`
      } else {
        esmHelpers.add(__exportLet)
        compiled = `__exportLet(${exportsId}, "${name}", () => ${name})`
      }
      editor.appendLeft(end, kReturn + compiled + kSemi)
    }
  } else if (imported && path.isExportAllDeclaration()) {
    const fromExpr = imported.alias || awaitRequire(imported.source)
    editor.appendRight(
      start,
      `__exportAll(${exportsId}, ${fromExpr})` + kSemiReturn
    )
    esmHelpers.add(__exportAll)
  } else if (path.isExportDefaultDeclaration()) {
    const defaultDecl = path.get('declaration')

    let compiled = `${exportsId}.default = `
    if (
      (defaultDecl.isFunctionDeclaration() ||
        defaultDecl.isClassDeclaration()) &&
      defaultDecl.node.id
    ) {
      compiled += ` ${defaultDecl.node.id.name}`
      editor.appendLeft(end, kReturn + compiled + kSemi)
    } else {
      editor.appendRight(start, compiled)
    }
  }
}

function rewriteExportSpecifier(
  local: string,
  exported: t.Identifier | t.StringLiteral,
  isConst: boolean,
  esmHelpers: Set<Function>
) {
  let property: string
  let assignee: string | undefined

  if (t.isStringLiteral(exported)) {
    property = exported.value.replace(/"/g, '\\"')
    if (isConst) {
      assignee = `${exportsId}["${property}"]`
    }
  } else {
    property = exported.name
    if (isConst) {
      assignee = `${exportsId}.${property}`
    }
  }

  if (isConst) {
    return `${assignee} = ${local}`
  }

  esmHelpers.add(__exportLet)
  return `__exportLet(${exportsId}, "${property}", () => ${local})`
}

export function generateRequireCalls(
  path: NodePath<t.ImportDeclaration>,
  source: string,
  bindings: BindingMap,
  esmHelpers: Set<Function>,
  forceLazyBinding: (
    imported: string[],
    source: string
  ) => string[] | boolean | undefined
) {
  const requireCall = awaitRequire(source)

  const specifiers = path.get('specifiers')
  if (!specifiers.length) {
    return requireCall
  }

  const lazyBindings = findLazyBindings(source, specifiers, forceLazyBinding)

  let moduleAlias: string | undefined
  let defaultAlias: string | undefined
  let namespaceAlias: string | undefined
  let constBindings: [alias: string, imported: string][] = []

  for (const spec of specifiers) {
    const alias = spec.node.local.name
    const binding = spec.scope.getBinding(alias)
    if (!binding) {
      throw Error('Binding not found')
    }
    const { imported } = spec.node as t.ImportSpecifier
    if (t.isIdentifier(imported)) {
      // Technically, a "default" binding is a constant binding, but
      // special handling is needed for the `__importDefault` helper.
      const isConstBinding =
        !lazyBindings.includes(imported.name) && !isExported(binding)

      if (isConstBinding) {
        constBindings.push([alias, imported.name])
        continue
      }
    }
    let accessor: string | undefined
    if (spec.isImportNamespaceSpecifier()) {
      namespaceAlias = alias
    } else if (spec.isImportDefaultSpecifier()) {
      const isConstBinding =
        !lazyBindings.includes('default') && !isExported(binding)

      if (isConstBinding) {
        defaultAlias = alias
      } else {
        accessor = '.default'
      }
    } else if (spec.isImportSpecifier()) {
      const { imported } = spec.node
      if (t.isIdentifier(imported)) {
        accessor = '.' + imported.name
      } else {
        accessor = `["${imported.value}"]`
      }
    }
    if (accessor) {
      moduleAlias ||= path.scope.generateUid(sourceAlias(source))
      bindings.set(binding, moduleAlias + accessor)
    }
  }
  if (needsModuleAlias(constBindings, namespaceAlias, defaultAlias)) {
    moduleAlias ||= path.scope.generateUid(sourceAlias(source))
  }

  const declarators: string[] = []

  if (moduleAlias) {
    declarators.push(`${moduleAlias} = ${requireCall}`)
    for (const [alias, imported] of constBindings) {
      declarators.push(`${alias} = ${moduleAlias}.${imported}`)
    }
  } else if (constBindings.length) {
    for (const [alias, imported] of constBindings) {
      declarators.push(alias == imported ? imported : `${imported}: ${alias}`)
    }
    return `const { ${declarators.join(', ')} } = ${requireCall}`
  }
  if (namespaceAlias) {
    const argument = moduleAlias || requireCall
    declarators.push(`${namespaceAlias} = __importAll(${argument})`)
    esmHelpers.add(__importAll)
  }
  if (defaultAlias) {
    const argument = moduleAlias || requireCall
    declarators.push(`${defaultAlias} = __importDefault(${argument})`)
    esmHelpers.add(__importDefault)
  }

  return 'const ' + declarators.join(', ')
}

function isExported(binding: Binding) {
  return binding.referencePaths.some(path =>
    path.findParent(parent => parent.isExportNamedDeclaration())
  )
}

function needsModuleAlias(
  staticBindings: any[],
  namespaceAlias?: string,
  defaultAlias?: string
) {
  return Boolean(
    staticBindings.length
      ? namespaceAlias || defaultAlias
      : namespaceAlias && defaultAlias
  )
}

function findLazyBindings(
  source: string,
  specifiers: NodePath[],
  filter: (imported: string[], source: string) => boolean | string[] | undefined
) {
  const imported: string[] = []
  for (const spec of specifiers) {
    const used = spec.isExportSpecifier()
      ? spec.node.local
      : spec.isImportSpecifier()
      ? spec.node.imported
      : spec.isImportDefaultSpecifier()
      ? t.identifier('default')
      : null

    if (t.isIdentifier(used)) {
      imported.push(used.name)
    }
  }

  if (imported.length) {
    const forced = filter(imported, source)
    return forced == true ? imported : forced || []
  }
  return imported
}
