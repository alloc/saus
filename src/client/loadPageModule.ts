import type { RouteParams } from '../core'
import { getPagePath } from '../utils/getPagePath'
import { loadClientState } from './state'
import routes from './routes'

export const loadPageModule = (routePath: string, routeParams?: RouteParams) =>
  loadClientState(getPagePath(routePath, routeParams)).then(
    () => import(/* @vite-ignore */ routes[routePath])
  )
