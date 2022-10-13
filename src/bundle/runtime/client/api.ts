import { BASE_URL, isDebug } from '@client/baseUrl'
import { prependBase as prepend } from '@utils/base'

export * from '@client/node/api'
export { default as routes } from '@client/routes'
export { BASE_URL, isDebug }

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
