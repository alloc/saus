import type { RenderedPage } from '../../core'
import { getCachedState } from '../../runtime/getCachedState'

export const loadPageState = (pagePath: string) =>
  getCachedState<RenderedPage>(pagePath).then(page => page?.state)
