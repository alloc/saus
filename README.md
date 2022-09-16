# saus ![](https://img.shields.io/badge/status-pre--alpha-red)

> Work-in-progress SSR framework (powered by Vite)

Its goal is to be the common core for **every** SSR framework, which means it needs to be highly customizable. Vite plugins can only take you so far. Saus extends the Vite plugin interface with powerful new hooks, builds on Vite's dev server, adds a flexible client/server runtime, and provides the `saus` CLI tool.

### Features

- Has JS-defined page routes
- Can serve any HTTP response (not just HTML)
- Has layout modules for easy code reuse
- Has state modules designed for HTTP caching
- Uses its own SSR engine (instead of Vite's)
- Can isolate stateful SSR modules between page requests
- Has deployment plugins for your entire stack (not just SSR bundle)
- Has CLI-driven management of encrypted secrets
- Can pre-render at build-time
- Has helpers for client-side routing (optional)
- Has runtime SSR plugins
- Has hidden debug URLs that let you safely inspect unminified production code with sourcemaps
- Has everything Vite can do

### Roadmap

- Multi-threaded SSR handling
- Nested routes
- Generate one SSR bundle per route (instead of a monolith)
- Server-only components
- File-based routing plugin
- Compile-time evaluation
- Astro support
- Marko support

### Documentation

I haven't written any yet. This is pre-alpha!
