# @saus/purge

This package provides a central place for plugins to define APIs for purging (or invalidating) cached resources on any platform. It exposes a `/[secret]/purge` route with a POST endpoint for triggering these plugin-defined APIs.

## Route usage

The purge route responds to `POST` requests with a body like this:

```ts
{
  "paths": ["/x", "/y", "/z"]
}
```

## Project usage

In your routes module, call the setup function:

```ts
import { usePurgeRoute } from '@saus/purge'

usePurgeRoute('secret')
```

## Plugin usage

Plugins add their callbacks like so:

```ts
import { onPurge } from '@saus/purge'

onPurge(paths => {})
```
