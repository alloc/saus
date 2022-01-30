import { t } from './index'

export function generateRequireCalls(
  node: t.ImportDeclaration,
  requireIdent: string,
  requireCalls: string[],
  moduleId = node.source.value,
  moduleType?: 'esm' | 'cjs'
) {
  const requireCall = `await ${requireIdent}("${moduleId}")`
  const bindings: string[] = []

  let needsImportStar = false
  let needsImportDefault = false

  for (const spec of node.specifiers) {
    const alias = spec.local.name
    if (t.isImportNamespaceSpecifier(spec)) {
      needsImportStar = true
      requireCalls.push(
        moduleType == 'cjs'
          ? `const ${alias} = ${requireCall};\n`
          : moduleType == 'esm'
          ? `const { ...${alias} } = ${requireCall}; ` +
            `delete ${alias}.default;\n`
          : `const ${alias} = __importStar(${requireCall});\n`
      )
    } else if (t.isImportDefaultSpecifier(spec)) {
      if (moduleType !== 'esm') {
        needsImportDefault = true
        requireCalls.push(`const ${alias} = __importDefault(${requireCall});\n`)
      } else {
        bindings.push(`default: ${alias}`)
      }
    } else {
      bindings.push(
        spec.imported.start == spec.local.start
          ? alias
          : t.isIdentifier(spec.imported)
          ? `${spec.imported.name}: ${alias}`
          : `["${spec.imported.value.replace(/"/g, '\\"')}"]: ` + alias
      )
    }
  }

  if (bindings.length) {
    const list = bindings.join(', ')
    requireCalls.push(`const { ${list} } = ${requireCall};\n`)
  } else if (!node.specifiers.length) {
    requireCalls.push(`${requireCall};\n`)
  }

  return { needsImportStar, needsImportDefault }
}
