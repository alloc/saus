import { Endpoint } from './endpoint'
import { routesModule } from './global'

export function onRequest(hook: Endpoint.RequestHook): void
export function onRequest(priority: number, hook: Endpoint.RequestHook): void
export function onRequest(
  arg1: number | Endpoint.RequestHook,
  hook?: Endpoint.RequestHook
): void {
  addHook((routesModule.requestHooks ||= []), arg1, hook!)
}

export function onResponse(hook: Endpoint.ResponseHook): void
export function onResponse(priority: number, hook: Endpoint.ResponseHook): void
export function onResponse(
  arg1: number | Endpoint.ResponseHook,
  hook?: Endpoint.ResponseHook
): void {
  addHook((routesModule.responseHooks ||= []), arg1, hook!)
}

export function onUncaughtError(hook: Endpoint.ErrorHook): void
export function onUncaughtError(
  priority: number,
  hook: Endpoint.ErrorHook
): void
export function onUncaughtError(
  arg1: number | Endpoint.ErrorHook,
  hook?: Endpoint.ErrorHook
): void {
  addHook((routesModule.errorHooks ||= []), arg1, hook!)
}

function addHook<T extends { priority?: number }>(
  hooks: T[],
  arg1: number | T,
  hook: T
): void {
  if (typeof arg1 == 'number') {
    hook.priority = arg1
  } else {
    hook = arg1
    hook.priority = 0
  }
  const priority = hook.priority!
  const index = hooks.findIndex(hook => priority < hook.priority!)
  if (index >= 0) {
    hooks.splice(index, 0, hook)
  } else {
    hooks.push(hook)
  }
}
