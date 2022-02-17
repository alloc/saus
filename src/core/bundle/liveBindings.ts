import type {
  Program,
  Node,
  ImportDeclaration,
  ImportSpecifier,
  ExportNamedDeclaration,
} from 'estree'
import { PartialResolvedId } from 'rollup'
import type { IsolatedModuleMap } from './isolateRoutes'

/**
 * Three types of live bindings:
 * - `variable`  \
 *   A local variable was exported and is mutable.
 * - `import`  \
 *   An import binding was exported and might be mutable.
 * - `module`  \
 *   An entire module was re-exported and might be mutable.
 */
export type LiveBinding = VariableBinding | ImportBinding | ModuleBinding

interface VariableBinding {
  type: 'variable'
  name: string
}

interface ImportBinding {
  type: 'import'
  name: string
  imported: string
  source: string
}

interface ModuleBinding {
  type: 'module'
  source: string
}

export async function findLiveBindings(
  program: Program,
  resolveId: (id: string) => Promise<string | null>
) {
  const liveBindings: LiveBinding[] = []

  const createdIds: string[] = []
  const importedIds: Record<string, ImportDeclaration> = {}
  const namedExports: ExportNamedDeclaration[] = []

  for (const node of program.body) {
    if (node.type == 'ExportNamedDeclaration') {
      const decl = node.declaration
      if (!decl) {
        namedExports.push(node)
        continue
      }
      if (decl.type == 'VariableDeclaration' && decl.kind !== 'const') {
        const exportedIds: string[] = []
        collectDeclaredIds(decl, exportedIds)
        for (const name of exportedIds) {
          // Declare a variable and export it, all in one statement
          liveBindings.push({ type: 'variable', name })
        }
      }
    } else if (node.type == 'ExportAllDeclaration') {
      const source = node.source.value as string
      const resolvedId = await resolveId(source)
      if (resolvedId)
        liveBindings.push({
          type: 'module',
          source: resolvedId,
        })
    } else if (node.type == 'ImportDeclaration') {
      for (const spec of node.specifiers) {
        if (spec.type == 'ImportSpecifier') {
          importedIds[spec.local.name] = node
        }
      }
    } else if (node.type == 'VariableDeclaration' && node.kind !== 'const') {
      collectDeclaredIds(node, createdIds)
    }
  }

  for (const decl of namedExports) {
    let source = decl.source?.value as string | undefined

    for (const spec of decl.specifiers) {
      const id = spec.local.name
      const name = spec.exported.name

      // Export from another module
      if (source !== undefined) {
        const resolvedId = await resolveId(source)
        if (resolvedId)
          liveBindings.push({
            type: 'import',
            name,
            imported: id,
            source: resolvedId,
          })
      }

      // Export a local variable
      else if (createdIds.includes(id)) {
        liveBindings.push({ type: 'variable', name })
      }

      // Export an import binding
      else {
        const importDecl = importedIds[id]
        const source = importDecl?.source.value as string | undefined
        const resolvedId = source && (await resolveId(source))
        if (resolvedId) {
          let imported!: string
          importDecl.specifiers.find(spec => {
            if (id == spec.local.name) {
              imported = (spec as ImportSpecifier).imported.name
              return true
            }
          })
          liveBindings.push({
            type: 'import',
            name,
            imported,
            source: resolvedId,
          })
        }
      }
    }
  }

  return liveBindings
}

export function matchLiveBinding(
  name: string,
  liveBindings: LiveBinding[],
  isolatedModules: IsolatedModuleMap
): boolean {
  return liveBindings.some(binding => {
    if (binding.type == 'variable') {
      return binding.name == name
    }
    const module = isolatedModules[binding.source]
    if (!module || !module.liveBindings) {
      return false
    }
    if (binding.type == 'import') {
      if (binding.name !== name) {
        return false
      }
      // TODO: resolve the module source??
      return matchLiveBinding(
        binding.imported,
        module.liveBindings,
        isolatedModules
      )
    }
    return matchLiveBinding(name, module.liveBindings, isolatedModules)
  })
}

const declarationKeys: Record<string, string[]> = {
  ArrayPattern: ['elements'],
  ObjectPattern: ['properties'],
  Property: ['value'],
  RestElement: ['argument'],
  VariableDeclaration: ['declarations'],
  VariableDeclarator: ['id'],
}

function collectDeclaredIds(node: Node, ids: string[]) {
  if (node.type == 'Identifier') {
    ids.push(node.name)
    return
  }
  const keys = declarationKeys[node.type]
  if (keys) {
    for (const key of keys) {
      const value = (node as any)[key]
      if (Array.isArray(value)) {
        value.forEach(child => collectDeclaredIds(child, ids))
      } else {
        collectDeclaredIds(value, ids)
      }
    }
  }
}
