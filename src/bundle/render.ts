import { ParsedRoute, RegexParam } from '../../core/routes'

type RendererInit = () => Promise<any>

const renderers: [ParsedRoute, RendererInit][] = []

export async function loadRenderers(pagePath: string) {
  for (const [route, init] of renderers) {
    if (route.pattern.test(pagePath)) {
      await init()
    }
  }
}

const allMatch = { pattern: /./, keys: [] }

export function addRenderers(hooks: [string | undefined, RendererInit][]) {
  for (const [route, init] of hooks) {
    const parsedRoute = route ? RegexParam.parse(route) : allMatch
    renderers.push([parsedRoute, init])
  }
}
