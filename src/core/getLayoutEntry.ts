import path from 'path'
import { Route } from '../../core'

const importRE = /\b\(["']([^"']+)["']\)/

function parseDynamicImport(fn: Function, importer?: string) {
  const match = importRE.exec(fn.toString())
  if (!match) {
    throw Error('Failed to parse dynamic import')
  }
  if (importer) {
    return path.resolve(path.dirname(importer), match[1])
  }
  return match[1]
}

export function getLayoutEntry(
  route: Pick<Route, 'layout' | 'file'>,
  defaultLayoutId: string
): string {
  if (typeof route.layout == 'function') {
    return parseDynamicImport(route.layout, route.file)
  }
  return route.layout || defaultLayoutId
}
