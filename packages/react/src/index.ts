import * as ReactDOM from 'react-dom/server'
import { defineLayoutRenderer } from 'saus/core'
import './stack'

export const defineLayout = defineLayoutRenderer({
  hydrator: '@saus/react/hydrator.ts',
  toString: ReactDOM.renderToString,
})

export * from './types'
