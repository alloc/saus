import { prependBase as prepend } from '../utils/base'

export * from './index.node'
export { default as routes } from './routes'

export const BASE_URL = import.meta.env.BASE_URL
export function prependBase(uri: string, base = BASE_URL) {
  return prepend(uri, base)
}

export const applyHead = unsupportedFn('applyHead')

function unsupportedFn(name: string) {
  return () => {
    throw Error(
      `Cannot call "${name}" in SSR environment. ` +
        `Wrap the call with \`if (!${'import.meta'}.env.SSR)\` to avoid it.`
    )
  }
}
