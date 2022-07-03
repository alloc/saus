import * as ReactDOM from 'react-dom/server'
import { addConfigHook, defineLayoutRenderer } from 'saus/core'
import './stack'

addConfigHook('./vite.config')

export const defineLayout = defineLayoutRenderer({
  hydrator: '@saus/react/hydrator/index.tsx',
  toString: ReactDOM.renderToString,
})

export * from './types'

declare module 'saus/core' {
  export interface UserConfig {
    babel?: import('@vitejs/plugin-react').BabelOptions
    react?: Omit<import('@vitejs/plugin-react').Options, 'babel'>
  }
}
