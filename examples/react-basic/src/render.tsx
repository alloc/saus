import * as React from 'react'
import { render } from '@saus/react'
import { App } from './App'

render('/*', (module, params) => {
  const Page = module.default as React.ComponentType<any>
  return (
    <html>
      <head>
        <title>{params.name || 'Home'}</title>
        <link
          href="https://cdn.jsdelivr.net/npm/modern-normalize@1.1.0/modern-normalize.min.css"
          rel="stylesheet"
        />
      </head>
      <body>
        <App>
          <Page {...params} />
        </App>
      </body>
    </html>
  )
}).then(() => {
  console.log('hello', import.meta.env.SSR ? 'server' : 'client')
})
