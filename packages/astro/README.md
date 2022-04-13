# @saus/react

Pre-render your pages with React and `@saus/react` will generate the module that hydrates your page on the client-side. Use JSX to render your `<head>` and `<body>` tags. Use the automatic JSX runtime and Fast Refresh.

Start by importing the `render` function in your project's `src/render.tsx` module (or the `saus.render` module defined in your Vite config).

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

&nbsp;

## Limitations

To reduce code complexity in the client generator, your render functions have the following limitations.

&nbsp;

**Keep `<head>` and `<body>` elements within `<html>` subtree.**

For the `<head>`-only logic to be tree-shaked, it can't be "lifted" out of the `<html>` subtree.

```tsx
// Bad
const Head = () => (
  <head>{...}</head>
)
return (
  <html>
    <Head />
  </html>
)

// Good
return (
  <html>
    <head>{...}</head>
  </html>
)
```

If you want to reuse `<head>` children between renderers, you can write a component that returns a JSX fragment containing the scripts, stylesheets, etc. that you wish to share between them.

```tsx
const SharedHeadTags = () => (
  <>
    <link rel="icon" href="/favicon.ico" type="image/x-icon" />
    <link rel="stylesheet" href="…" />
    <script src="…"></script>
  </>
)

// In your render functions:
return (
  <html>
    <head>
      <SharedHeadTags />
    </head>
  </html>
)
```

The same limitation applies to the `<body>` element, but not for tree-shaking reasons.

The `<body>` element is only required when your render function returns an `<html>` element. Otherwise, you're free to omit `<body>` and just return its children. In that case, `@saus/react` inserts the `<body>` element in SSR before rendering your JSX into a string, to ensure the HTML is well-formed. If you lift the `<body>` element into a component, you'll end up with two `<body>` elements in the HTML string, which is bad.

&nbsp;

**Keep `return` statements simple.**

When returning JSX, prefer `if` blocks over ternary expressions (eg: `a ? <b /> : <c />`) or conditional expressions (eg: `a && <b />`).

```tsx
// Bad
return condition ? <div /> : <body />

// Good
if (condition) {
  return <div />
}
return <body />
```

This **does not apply** to nested elements; just the root element that immediately follows the `return` keyword. As a rule of thumb, if your element is wrapped in a JSX curly expression (eg: `{a && <b />}`), any syntax is allowed. Additionally, this rule does _not_ apply to JSX elements in variable declarations (eg: `const a = b ? <c /> : <d />`).

Wrapping your root element in parentheses is allowed.

```tsx
return (
  <html>{...}</html>
)
```
