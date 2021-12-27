# saus/html

This module provides the `transformHtml` and `resolveHtmlImports` hooks that should be called from the `routes` module (defined in `saus.yaml`).

### transformHtml

The `transformHtml` hook is passed a visitor object (very similar to a Babel visitor), which may have an `open` method (called before descendants are traversed), a `close` method (called after descendants are traversed), and any other method (called when a tag of the same name is found, after `open` method is called, but before descendants are traversed).

The methods can be asynchronous. They receive an `HtmlTagPath` object (which contains an AST node, a parent path, a `traverse` method, a few properties, and mutation methods) and an `HtmlVisitorState` object (which contains a `page` object and any state set by other visitors).

```ts
transformHtml({
  open: path => console.log('open:', path.tagName),

  close: path => console.log('close:', path.tagName),
})
```
