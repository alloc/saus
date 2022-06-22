# @saus/page-store

Basic plugin for storing rendered pages.

- Only HTML responses and their `.html.js` modules are stored.
- 

## Usage

Call it from your routes module.

```ts
import { usePageStore } from '@saus/page-store'
import { createStore } from '@saus/aws-elasticache'

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
    }
  })
```
