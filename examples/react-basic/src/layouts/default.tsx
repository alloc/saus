import { defineLayout } from '@saus/react'
import * as React from 'react'
import { unsafe } from 'saus'
import { prependBase } from 'saus/client'
import { App } from '../App'

type Module = {
  default: React.ComponentType<any>
}

export default defineLayout<any, any, Module>({
  render: ({ module: { default: Page }, params, props }) => (
    <App>
      <Page {...props} {...params} />
    </App>
  ),
  head: ({ params }) => unsafe.html`
    <meta charset="utf-8" />
    <title>Pokemon Wiki</title>
    <link rel="icon" type="image/svg+xml" href=${prependBase(
      params.name ? '/' + params.name + '.webp' : '/favicon.svg'
    )} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
    <link
      href="https://fonts.googleapis.com/css2?family=Noto+Serif&display=swap"
      rel="stylesheet"
    />
    <link
      href="https://cdn.jsdelivr.net/npm/modern-normalize@1.1.0/modern-normalize.min.css"
      rel="stylesheet"
    />
  `,
})
