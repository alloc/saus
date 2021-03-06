### Excuse the dust.
Saus is still in development (see the `next` branch) and is wholly undocumented for the foreseeable future. You can help by sponsoring [@aleclarson](https://github.com/sponsors/aleclarson), so he can spend more time on getting Saus ready for general availability!

---

# saus

[![npm](https://img.shields.io/npm/v/saus.svg)](https://www.npmjs.com/package/saus)
[![Code style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://paypal.me/alecdotbiz)

Radically simple SSG powered by Vite, with automatic page hydration and practically zero config.

Check out the `./examples/` folder [here](https://github.com/alloc/saus/tree/master/examples).

&nbsp;

## Commands

**Development**  
Run `saus dev` to start a Vite dev server with Saus plugins.

**Production**  
Run `saus build` to generate pages.

&nbsp;

## Routes

Saus lets you implement client-side routing, but it still needs your routes so it can generate static pages at build time. Saus handles server-side routing and client-side hydration.

Add a `routes` path to your `saus.yaml` config, so Saus knows your routes. Since your routes module runs in a Node environment, it's recommended to create a `./src/node` folder and keep your routes in there.

```yml
# saus.yaml
routes: ./src/node/routes.ts
```

Routes are defined with the `route` function. They are matched in reverse order.

```ts
// ./src/node/routes.ts
import { route } from 'saus'

route('/', () => import('./routes/Home'))
route('/about', () => import('./routes/About'))
```

### Route Parameters

Saus uses [regexparam](https://github.com/lukeed/regexparam#readme) to implement route parameters, so your route paths can contain dynamic parts, including wild cards and regular expressions.

- Static (`/foo`, `/foo/bar`)
- Parameter (`/:title`, `/books/:title`, `/books/:genre/:title`)
- Parameter w/ Suffix (`/movies/:title.mp4`, `/movies/:title.(mp4|mov)`)
- Optional Parameters (`/:title?`, `/books/:title?`, `/books/:genre/:title?`)
- Wildcards (`*`, `/books/*`, `/books/:genre/*`)

### Generated Paths

When you're using route parameters and want to generate static pages at build time, you can define a `paths` function. When only one route parameter exists, `paths` only needs to return an array of strings/numbers. If multiple route parameters exist, it returns an array of arrays instead.

```ts
import { route } from 'saus'
import fs from 'fs-extra'

route('/posts/:id', () => import('./routes/Post'), {
  paths: () => fs.readJson('./data/posts.json').map(post => post.id),
})
```

### Data Loading

If your route needs to load some data before it can render, you can define the `state` method. It receives the route parameters, and returns an object that is merged into the renderer state, which is used to render HTML on both the client and server.

```ts
import { route } from 'saus'
import fetch from 'node-fetch'

route('/posts/:id', () => import('./routes/SinglePost'), {
  state: id => fetch(`https://jsonplaceholder.typicode.com/posts/${id}`),
  paths: () => [1, 2, 3],
})
```

### Default Route

When no matching route is found, Saus uses the default route (if you define one).

```ts
import { route } from 'saus'

route(() => import('./routes/404'))
```

Running `saus build` will emit `dist/404.html` when a default route is defined, which is often used as an "SPA fallback" by static site hosting providers.

### Client Routing

Saus provides a basic `routes` object for client-side routing. It's your responsibility to implement client-side routing that fits your needs.

```ts
import { routes } from 'saus/client'

const module = await routes['/']()
```

See the [`Router`](https://github.com/alloc/saus/blob/master/examples/react-basic/src/Router.tsx) module in `./examples/react-basic` for an example of client routing.

&nbsp;

## Rendering

Saus is unopinionated about your view framework. Instead, it has a concept called a "renderer", whose logic should be isomorphic (meaning it can run in both Node and web environments).

First, tell Saus where to find your render module.

```yml
# saus.yaml
render: ./src/render.tsx
```

Define a Saus renderer by calling the `render` function in your render module. It takes an optional route path as its first argument. If no route path is given, you've defined the default renderer.

```ts
import { render, escape } from 'saus'

// Simple renderer that expects an HTML string
render((module, params, state) => {
  return escape`<html>${module.default}</html>`
})

// Render differently for a specific route
render('/posts/:id', async (module, params, state) => {
  return escape`<html>${await fetchPost(params.id)}</html>`
})
```

Renderers receive the following arguments:

- `module` is loaded with the `import` function of the matching route
- `params` is an object of route parameters
- `state` is a JSON object that is sent to the client

The `state` object can contain any JSON data you need to render the page on both client and server. Its properties should only be accessed inside a `render` callback. By default, it includes the `routePath` and `routeParams` (same as the `params` argument).

Renderers are matched in reverse order (except for the default renderer, of course).

### Renderer Packages

Your view framework of choice might have a `@saus/*` package you can use.

In the case of `@saus/react`, client hydration works out-of-the-box. The `div#root` element is created and hydrated with `ReactDOM.hydrate` automatically.

```tsx
import { render } from '@saus/react'

render(async (module, params, state) => {
  const Page = module.default
  return (
    <html>
      <head>
        <title>My App</title>
      </head>
      <body>
        <Page {...params} />
      </body>
    </html>
  )
}).then(() => {
  // An isomorphic post-render effect.
  // This runs after HTML is generated on the server,
  // and after hydration on the client.
})
```

## Custom Renderer

If your view framework has no official package, you can write your own renderer. A custom renderer has the following parts: (1) a wrapper around `saus.render` which generates HTML from your views, and (2) an optional `withClient` callback that generates client-side hydration logic.

### Client Hydration

Each `render` call has its own client provider defined by the `withClient` method. The callback passed to `withClient` is responsible for generating the client that hydrates the page. This is entirely optional, of course.

Typically, the client provider will generate the client by parsing its `render` call with Babel. See the [`getClientProvider`](https://github.com/alloc/saus/blob/b75168eafbb2ed618be26dc98b903919de00ece5/packages/react/src/node/client.ts#L18) function in `./packages/react` for a good idea of how that works.

Saus provides helpers to make client generation easier through its `saus/babel` module. [Learn more](https://github.com/alloc/saus/tree/master/babel)

### Vite Configuration

Custom renderers can configure Vite for you. For example, `@vitejs/plugin-react` is added by `@saus/react` automatically (see [here](https://github.com/alloc/saus/blob/b75168eafbb2ed618be26dc98b903919de00ece5/packages/react/src/index.ts#L6)). This is done with the `saus.configureVite` function.

Note that `configureVite` should only be called by renderer packages. If you need to configure Vite yourself, just create a `vite.config.ts` module in your project root.
