# react-basic

This is a playground for React + Saus.

&nbsp;

## Points of Interest

Points of interest include:

- ### src/render.tsx

  Where your pages are rendered. Its logic is assumed to be isomorphic (meaning it can run in Node and web environments), because `@saus/react` generates a client from it, which provides automatic page hydration.

- ### src/node/routes.ts

  Where your routes are defined, and their root components are imported. For the `/pokemon/:name` route, there exists a `query` function that informs Saus on which pages can be statically generated.

- ### vite.config.ts

  Notice the complete absence of boilerplate configuration. In fact, you could delete this module with no consequence, because `@saus/react` injects React plugins for you automatically.

- ### src/Router.tsx
  This module provides client-side routing with the help of [`navaid`](https://github.com/lukeed/navaid). It uses the `routes` export from `saus/client` to know which module to load when a route is visited, which allows for SPA-style navigation. This module also hi-jacks clicks to `<a>` elements and routes them through `navaid` when possible.

&nbsp;

## What's Missing

This example doesn't extend the client state (eg: the `state` export of `saus/client`) with page-specific data, so there's no example of server-loaded data being hydrated with and no example of `state` being updated on navigation. Also, there's no example of `<head>` tags being updated on navigation.
