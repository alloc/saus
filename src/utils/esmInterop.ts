/** Runtime `import *` for compiled ESM. */
export function __importStar(exports: any) {
  if (exports && exports.__esModule && 'default' in exports) {
    exports = Object.assign({}, exports)
    delete exports.default
    return exports
  }
  return exports
}

/** Runtime `default` export unwrapping. */
export function __importDefault(exports: any) {
  return exports && exports.__esModule ? exports.default : exports
}
