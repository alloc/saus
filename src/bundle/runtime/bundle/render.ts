import type { ParsedRoute } from '@/routes'
import { parseRoutePath } from '@utils/parseRoutePath'
import { plural } from '@utils/plural'
import { debug } from '@vm/debug'

type RendererInit = () => Promise<any>

const renderers: [ParsedRoute, RendererInit][] = []

export async function loadRenderers(pagePath: string) {
  const time = Date.now()
  for (const [route, init] of renderers) {
    if (route.pattern.test(pagePath)) {
      await init()
    }
  }
  debug(
    `Loaded ${plural(renderers.length, 'renderer')} in ${Date.now() - time}ms`
  )
}

const allMatch = { pattern: /./, keys: [] }

export function addRenderers(hooks: [string | undefined, RendererInit][]) {
  for (const [route, init] of hooks) {
    const parsedRoute = route ? parseRoutePath(route) : allMatch
    renderers.push([parsedRoute, init])
  }
}
