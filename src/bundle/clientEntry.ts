export * from '../client/index.node'
export { default as routes } from '../client/routes'

export const applyHead = unsupportedFn('applyHead')

function unsupportedFn(name: string) {
  return () => {
    throw Error(
      `Cannot call "${name}" in SSR environment. ` +
        `Wrap the call with \`if (!import.meta.env.SSR)\` to avoid it.`
    )
  }
}
