// Redirect "saus/core" imports here.
export * from '../../core/render'
export * from '../../core/html'
export * from '../../core/http'
export { setup } from './context'

// This is also exported by "saus/src/core/client" but we
// want to avoid processing that module, since it has heavy
// dependencies that bog down Rollup.
export const defineClient = (x: any) => x

// Ignore config hooks in SSR bundle.
export const addConfigHook = () => {}

export { default as endent } from 'endent'
export { default as md5Hex } from 'md5-hex'
