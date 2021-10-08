# @saus/react

Pre-render your pages with React and `@saus/react` will generate the module that hydrates your page on the client-side. Use JSX to render your `<head>` and `<body>` tags. Use the automatic JSX runtime and Fast Refresh.

Start by importing the `render` function in your project's `src/render.tsx` module (or whichever module you set `render` to in your `saus.yaml` file).

```ts
import { render } from '@saus/react'
```

Use it to define the default renderer. It receives the loaded module from the page's matching route. You can export whatever you like, but in this example, we're setting the `default` export to a React component, which represents the page content.

```ts
import { render } from '@saus/react'
import React from 'react'

render(module => {
  const Page = module.default as React.ComponentType
  return <Page />
})
```

### Route parameters

If you're using route parameters, you'll want to pass those into your `Page` component.

```ts
import { render } from '@saus/react'
import React from 'react'

render((module, { params }) => {
  const Page = module.default as React.ComponentType
  return <Page {...params} />
})
```

### Routed rendering

If a certain route needs its own logic, one option is to give it a dedicated renderer.

```ts
render('/books/:book', (module, { params }) => {
  return <body>{params.book}</body>
})
```

### Isomorphic rendering

It's important to remember that your renderer will run in both Node and web environments, so you need to be conscious about keeping your code compatible with both.

The one exception to that rule is when a variable is only used for rendering the optional `<head>` element. Any code used in `<head>` and not in `<body>` will be tree-shaked while generating the client renderer.
