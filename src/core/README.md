# src/core

This folder contains the lion's share of implementation details that may be shared between different CLI/API commands.

By default, modules in this folder are **NOT** intended to be bundled for deployment. The following subfolders are exceptions to this rule:

- `app/` \
  The application layer lives here. Rendering and routing. \
  Used by dev server and SSR bundles.

- `client/` \
  The `saus/client` API lives here. \
  Used in SSR and browser contexts.

- `http/` \
  Isomorphic HTTP helpers and types

- `node/` \
  Assorted helpers for Node.js only

- `runtime/` \
  Isomorphic internals of client and SSR runtimes.

- `utils/` \
  Isomorphic isolated helpers.

- `vite/` \
  Assorted helpers with a dependency on Vite. \
  Not specific to Saus internals.
