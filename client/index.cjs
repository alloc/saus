Object.assign(exports, require('../dist/client/index.node.js'))
Object.assign(exports, require('./baseUrl.cjs'))
exports.routes = require('./routes.cjs')
