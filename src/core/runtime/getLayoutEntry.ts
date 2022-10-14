import { parseLazyImport } from '@utils/parseLazyImport'
import path from 'path'
import type { Route } from './routeTypes'

export function getLayoutEntry(
  route: Pick<Route, 'path' | 'layout' | 'file'>,
  defaultLayoutId: string
): string {
  if (typeof route.layout == 'function') {
    const layoutEntry = parseLazyImport(route.layout)
    if (!layoutEntry) {
      throw Error(`Failed to parse "layoutEntry" for route: "${route.path}"`)
    }
    if (route.file) {
      return path.resolve(path.dirname(route.file), layoutEntry)
    }
    return layoutEntry
  }
  return route.layout || defaultLayoutId
}
