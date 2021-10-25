import type { Component } from 'solid-js'
import { render } from '@saus/solid'
import { App } from './App'

render((module, { params }) => {
  const Page = module.default as Component
  return (
    <App>
      <Page {...params} />
    </App>
  )
}).head(() => (
  <head>
    <title>Pokemon Wiki</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link
      href="https://cdn.jsdelivr.net/npm/modern-normalize@1.1.0/modern-normalize.min.css"
      rel="stylesheet"
    />
  </head>
))
