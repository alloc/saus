# HTML Manipulation

Saus provides hooks for traversal and manipulation of each page's HTML. These hooks run before any Vite plugins with `transformIndexHtml` hooks, and they must be added from your `routes` module (defined in `saus.yaml`).

Saus doesn't run Vite plugins within your SSR bundle, so you need to use these Saus-specific hooks (instead of `transformIndexHtml` Vite hooks) if you want to manipulate pages generated in SSR mode.

### transformHtml

The `transformHtml` hook is passed a visitor object (very similar to a Babel visitor), which may have an `open` method (called before descendants are traversed), a `close` method (called after descendants are traversed), and any other method (called when a tag of the same name is found, after `open` method is called, but before descendants are traversed).

The visitor's methods can return a promise to postpone other visitors. The methods receive an `HtmlTagPath` object (which contains an AST node, a parent path, a `traverse` method, a few properties, and mutation methods) and an `HtmlVisitorState` object (which contains a `page` object and any state set by other visitors).

### resolveHtmlImports

The `resolveHtmlImports` hook works similarly to Vite's `resolveId` hook, but it's called for URLs within each page's HTML (instead of JavaScript imports). This hook can be called as many times as you like, but the first resolver to return a non-null value will prevent other resolvers from being called.

```ts
import { resolveHtmlImports } from 'saus'

resolveHtmlImports(async (id, importer, state) => {
  if (/^https?:\/\//.test(id)) {
    // Pseudo code for downloading external URLs
    const localPath = await download(id, state.config.cacheDir)
    return path.relative(state.config.root, localPath)
  }

  // This state is always available to resolvers.
  state.tag // => [object HtmlTagPath]
  state.attr // => "href"
  state.page // => [object RenderedPage]
})
```
