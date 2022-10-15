## Project Structure

- `client/` \
  The `saus/client` API lives here. \
  Used in SSR and browser contexts.

- `core/` \
  Supporting modules for development, builds, and more.

  - `vite/` \
    Assorted helpers with a dependency on Vite. \
    Not specific to Saus internals.

- `runtime/` \
  Isomorphic internals of client and SSR runtimes.

  - `app/` \
    The application layer lives here. Rendering and routing. \
    Used by dev server and SSR bundles.

  - `html/` \
    Reusable logic for HTML processing

  - `http/` \
    Isomorphic HTTP helpers and types

- `utils/` \
  Isomorphic isolated helpers.

  - `node/` \
    Assorted helpers for Node.js only
