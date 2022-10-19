// This module is only used by the SSR dev server.
// In production SSR, this module is injected at runtime.
Object.assign(exports, require('./node/api.js'))
Object.assign(exports, require('./baseUrl.cjs'))
exports.routes = require('./routes.cjs')
