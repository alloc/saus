import { NodePath, t } from '@utils/babel'

export function getExportDeclarations(program: NodePath<t.Program>) {
  return program
    .get('body')
    .filter(stmt =>
      stmt.isExportDeclaration()
    ) as NodePath<t.ExportDeclaration>[]
}
