import { InferRouteParams } from '../core'

const paramRegex = /(?:\/|^)([:*][^/]*?)(\?)?(?=[/.]|$)/g

export const renderRoutePath = <RoutePath extends string>(
  route: RoutePath,
  params: InferRouteParams<RoutePath>
) =>
  route.replace(paramRegex, (x, key, optional) => {
    x = (params as any)[key == '*' ? 'wild' : key.substring(1)]
    return x ? '/' + x : optional || key == '*' ? '' : '/' + key
  })
