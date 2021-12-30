# saus/bundle

Access your SSR bundle by importing this from the module defined with `saus.bundle.entry` module in your Vite config. This module exports a function that takes a page URL (eg: `/foo?bar`) and returns a promise that resolves to a `RenderedPage` object, which contains an `html` string and `modules` array. The `html` string is ready to serve, while the `modules` array can be used in a HTTP/2 server push (avoiding round-trip requests), cached on an edge server like Cloudflare, and/or cached in memory for future requests.
