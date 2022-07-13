import * as ReactDOM from 'react-dom/server'
import { defineLayoutRenderer } from 'saus/core'
import './stack'

export const defineLayout = defineLayoutRenderer({
  hydrator: '@saus/react/hydrator',
  toString: ReactDOM.renderToString,
})

export * from './types'
