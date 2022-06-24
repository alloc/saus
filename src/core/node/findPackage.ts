import escalade from 'escalade/sync'

export function findPackage(fromDir: string) {
  return escalade(fromDir, (_parent, children) => {
    return children.find(name => name == 'package.json')
  }) as string | undefined
}
