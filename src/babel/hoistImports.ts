import { MagicString, NodePath, t } from './index'

export function hoistImports(
  imports: NodePath<t.ImportDeclaration>[],
  editor: MagicString
) {
  const importIdx = imports.findIndex(({ node }, i) => {
    const nextImport = imports[i + 1]
    return !nextImport || nextImport.node.start! - node.end! > 2
  })
  const hoistEndIdx = importIdx < 0 ? 0 : 1 + imports[importIdx].node.end!
  for (let i = importIdx + 1; i < imports.length; i++) {
    const { start, end } = imports[i].node
    // Assume import statements always end in a line break.
    editor.move(start!, 1 + end!, hoistEndIdx)
  }
  return imports[importIdx]
}
