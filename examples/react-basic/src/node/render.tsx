import * as React from 'react'
import { render } from '@stite/react'
import { App } from '../App'

render('/*', (module, params) => {
  const Page = module.default as React.ComponentType<any>
  return (
    <body>
      <App>
        <Page {...params} />
      </App>
    </body>
  )
})
