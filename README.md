# saus

[![npm](https://img.shields.io/npm/v/saus.svg)](https://www.npmjs.com/package/saus)
[![Code style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://paypal.me/alecdotbiz)

> Static sites for dummies

Nothing but a wrapper around Vite with pre-render support of multiple routes.

&nbsp;

## Routes

First, we need to know your routes.

```yml
# saus.yaml
routes: ./src/routes.ts
```

Your routes module maps each route to a module. If the route is dynamic, it also needs a `query` function to know which pages should be generated.

```ts
import { defineRoutes } from 'saus'
import fs from 'fs'

export default defineRoutes({
  '/': () => import('./routes/Home'),
  '/posts/:post': {
    render: () => import('./routes/Post'),
    query: () => fs.readdirSync('./data/posts'),
  },
})
```

### Client Routing

For client-side routing, your web app can import the routes module to receive a basic route-to-importer mapping. It's your responsibility to integrate a client router.

```ts
import routes from './routes'

routes['/'] // => [object Function]
routes['/']() // => [object Promise]
```

## Rendering

Next, you need at least one renderer to generate your pages.

```yml
# saus.yaml
render: ./src/node/render.tsx
```

Popular frameworks usually have a `@saus/*` package you can use.

```tsx
import { render } from '@saus/react'

render(async (route, params, module) => {
  const App = module.default
  return (
    <html>
      <body>
        <div id="root">
          <App route={route} params={params} />
        </div>
      </body>
    </html>
  )
})
```

That said, you can integrate unsupported frameworks easily.

```tsx
import {escape, render} from 'saus'

render(async (route, params, module) => {
  return escape`<html>${...}</html>`
})
```

## Developing

Run `saus dev` to start a Vite dev server with saus plugins injected.

## Building

Run `saus build` to generate pages.
