# @saus/page-store

Upload generated assets to remote storage, like S3 or anything you can think of.

## usePageStore

The `usePageStore` function is called from your routes module. It intercepts each HTTP response from your server and stores the following asset types:

- HTML pages produced by internal `servePages` app plugin
  - …and their `.html.js` modules (for client props injection)
- State modules loaded by the server (see `defineStateModule`)

### Purging old assets

By defining the `routes.purge` string option, you can expose an endpoint that accepts a JSON payload shaped like `{ paths: string[] }` for deleting assets from the page store as you see fit. You'll want to keep this endpoint private, so it doesn't get abused by a malicious actor.

### Example

```ts
import { usePageStore } from '@saus/page-store'
import { createStore } from '@saus/aws-elasticache'

// Skip uploads in development.
if (!import.meta.env.DEV)
  usePageStore({
    store: createStore({
      clusterUrl: import.meta.env.AWS_ELASTICACHE_URL,
      accessKeyId: import.meta.env.AWS_ACCESS_ID,
      secretAccessKey: import.meta.env.AWS_SECRET_KEY,
    }),
    routes: {
      // The route path for purging stored pages.
      // Should be unguessable to prevent abuse.
      purge: '/admin/purge/203631579',
    },
  })
```
