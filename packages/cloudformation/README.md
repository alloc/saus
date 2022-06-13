# @saus/html

Various helper functions for manipulating the HTML of pages within your `saus.routes` module.

Saus provides the `processHtml` hook for inspection and manipulation of each page's HTML. This hook runs before any Vite plugins with `transformIndexHtml` hooks. The one downside of this hook is how low-level it is. It doesn't parse the HTML for you or provide any API for easy manipulation. That's where the `@saus/html` package comes in handy.

&nbsp;

### traverseHtml

The `traverseHtml` hook is passed a visitor object (very similar to a Babel visitor), which may have an `open` method (called before descendants are traversed), a `close` method (called after descendants are traversed), and any other method (called when a tag of the same name is found, after `open` method is called, but before descendants are traversed).

**Method Signatures**

The visitor's methods can return a promise to postpone other visitors. The methods receive an `HtmlTagPath` object (which contains an AST node, a parent path, a `traverse` method, a few properties, and mutation methods) and an `HtmlVisitorState` object (which contains a `page` object and any state set by other visitors).

**Traversal Order**

Visitors are only called for HTML tags, so text nodes and attributes are not considered. Parent tags are visited before their descendants. You can call `path.skip` to avoid traversing a subtree with the current visitor, but other visitors are unaffected by `path.skip` calls they didn't make themselves. The `path.remove` method, on the other hand, _will_ affect other visitors, since there's no point in traversing a deleted subtree.

&nbsp;

### resolveHtmlImports

The `resolveHtmlImports` hook works similarly to Vite's `resolveId` hook, but instead of focusing on JavaScript imports, it's called for URLs within each page's HTML. This hook can be called as many times as you like, but the first resolver to return a non-null value will prevent other resolvers from being called.

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

&nbsp;

### downloadRemoteAssets

The `downloadRemoteAssets` function uses `traverseHtml` to find JS/CSS assets from third parties and downloads them to be rehosted by your own web server. This helps in reducing the number of HTTP connections needed by the end user's browser.
