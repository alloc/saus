# stite

[![npm](https://img.shields.io/npm/v/stite.svg)](https://www.npmjs.com/package/stite)
[![Code style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://paypal.me/alecdotbiz)

> Static sites for dummies

Nothing but a wrapper around Vite with pre-render support of multiple routes.

&nbsp;

## Routes

First, we need to know your routes.

```yml
# stite.yaml
routes: ./src/routes.ts
```

Your routes module maps each route to a module. If the route is dynamic, it also needs a `query` function to know which pages should be generated.

```ts
import { defineRoutes } from 'stite'
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
# stite.yaml
render: ./src/node/render.tsx
```

Popular frameworks usually have a `@stite/*` package you can use.

```tsx
import { render } from '@stite/react'

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
import {escape, render} from 'stite'

render(async (route, params, module) => {
  return escape`<html>${...}</html>`
})
```

## Developing

Run `stite dev` to start a Vite dev server with stite plugins injected.

## Building

Run `stite build` to generate pages.
