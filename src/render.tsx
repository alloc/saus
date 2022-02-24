import * as React from 'react'
import { render } from '@saus/react'
import { App } from '@/App'
import { prependBase } from '@/prependBase'

render((module, { params }) => {
  const Page = module.default as React.ComponentType<any>
  return (
    <App>
      <Page {...params} />
    </App>
  )
}).head(() => (
  <head>
    <meta charSet="utf-8" />
    <title>React Starter</title>
    <link rel="icon" type="image/svg+xml" href={prependBase('/favicon.svg')} />
    <link
      href="https://cdn.jsdelivr.net/npm/modern-normalize@1.1.0/modern-normalize.min.css"
      rel="stylesheet"
    />
  </head>
))
