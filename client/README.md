# saus/client

Client-side helpers for Saus pages

&nbsp;

## Exports

- `routes`  
  This is a generated module that maps page routes to their module loaders. You can use this in your client-side router for SPA-style navigation.

- `state`  
  This is the client state provided by your `render` call and included in the generated page as a JSON script. By default, it has `routePath` and `routeParams` properties.

&nbsp;

## Types

- `RouteModule`  
  The object type returned by a route's module loader.

- `RouteParams`  
  The type of the `state.routeParams` export.

- `ClientState`  
  The type of the `state` export.
