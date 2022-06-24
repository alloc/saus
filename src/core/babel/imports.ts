import { NodePath, t } from './babel'

export function getImportDeclaration(
  program: NodePath<t.Program>,
  moduleName: string
) {
  return program
    .get('body')
    .find(
      stmt => stmt.isImportDeclaration() && stmt.node.source.value == moduleName
    ) as NodePath<t.ImportDeclaration> | undefined
}

export function getImportDeclarations(program: NodePath<t.Program>) {
  return program
    .get('body')
    .filter(stmt =>
      stmt.isImportDeclaration()
    ) as NodePath<t.ImportDeclaration>[]
}
