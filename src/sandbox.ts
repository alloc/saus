import fs from 'fs'
import vm from 'vm'
import path from 'path'
import Module from 'module'
import MagicString from 'magic-string'
import convertSourceMap from 'convert-source-map'
import remapping from '@ampproject/remapping'
import { logger } from './context'

export type SandboxOptions = {
  sharedModules?: string[]
  global?: Record<string, any>
}

export interface Sandbox {
  global: Record<string, any>
  context: vm.Context
  moduleCache: Record<string, Module>
  mainModule?: Module
  load(code: string, filename: string, parentModule?: Module): any
}

export function createSandbox(options: SandboxOptions): Sandbox {
  const { sharedModules = [] } = options

  const global = createGlobalScope(options.global)
  global.global = global

  const sandbox: Sandbox = {
    global,
    context: vm.createContext(global),
    moduleCache: createModuleCache(sharedModules),
    load(code, filename, parentModule) {
      const { resolve } = Module.createRequire(filename)

      const module = new Module(filename, parentModule)
      this.moduleCache[filename] = module
      module.filename = filename

      if (filename.endsWith('.json')) {
        module.exports = JSON.parse(code)
        return module.exports
      }

      this.mainModule ??= module
      module.require = makeRequireFunction(
        module,
        resolve,
        require.extensions,
        this
      )

      const moduleArgs = {
        exports: module.exports,
        require: module.require,
        module,
        __filename: filename,
        __dirname: module.path,
      }

      code = wrapModule(code, filename, Object.keys(moduleArgs))

      const compiledWrapper: Function = vm.runInContext(code, this.context, {
        filename,
      })

      compiledWrapper.apply(module.exports, Object.values(moduleArgs))
      return module.exports
    },
  }

  // Source map support
  // sandbox.load(
  //   `require("source-map-support").install({ hookRequire: false })`,
  //   `/internal/source-map-support.js`
  // )

  return sandbox
}

export function createModuleCache(sharedModules: string[]) {
  return sharedModules.reduce((moduleCache, id) => {
    const resolvedId = require.resolve(id)

    // Initialize the module on-demand.
    Object.defineProperty(moduleCache, resolvedId, {
      get() {
        require(resolvedId)
        return getCachedModule(resolvedId)
      },
    })

    return moduleCache
  }, {} as Record<string, Module>)
}

function getCachedModule(filename: string): Module | undefined {
  return (Module as any)._cache[filename]
}

declare const TextEncoder: any
declare const TextDecoder: any

const createGlobalScope = (global?: any) => ({
  console,
  process,
  setImmediate,
  setInterval,
  setTimeout,
  Buffer,
  TextDecoder,
  TextEncoder,
  ...global,
})

const escapedRequire = require
const escapedResolutions = ['source-map-support']

function makeRequireFunction(
  parentModule: Module,
  resolve: NodeJS.RequireResolve,
  extensions: NodeJS.RequireExtensions,
  sandbox: Sandbox
): NodeJS.Require {
  function require(id: string) {
    if (Module.builtinModules.includes(id)) {
      return escapedRequire(id)
    }
    const filename = escapedResolutions.includes(id)
      ? escapedRequire.resolve(id)
      : resolve(id)
    const module = sandbox.moduleCache[filename]
    if (module) {
      return module.exports
    }
    const code = fs.readFileSync(filename, 'utf8')
    return sandbox.load(code, filename, parentModule)
  }
  require.main = sandbox.mainModule
  require.cache = sandbox.moduleCache
  require.resolve = resolve
  require.extensions = extensions
  return require
}

function wrapModule(code: string, filename: string, args: string[]) {
  let sourceMappingURL = ''
  code = code.replace(/\n\/\/# sourceMappingURL=[^\n]+/g, line => {
    sourceMappingURL = line.slice(1)
    return '\n'
  })

  const compiledCode = new MagicString(code)
  compiledCode.prependLeft(0, `(0,function(${args.join(',')}){\n`)
  compiledCode.appendRight(code.length, `\n})`)
  code = compiledCode.toString()

  if (sourceMappingURL) {
    // code += '\n' + sourceMappingURL
    const originalSourceMap = parseSourceMap(
      sourceMappingURL,
      path.dirname(filename)
    )
    const sourceMapChain: any[] = [
      compiledCode.generateMap(),
      originalSourceMap,
    ]
    try {
      const sourceMap = remapping(sourceMapChain, loadSourceMap)
      sourceMappingURL = convertSourceMap.fromObject(sourceMap).toComment()
      code += '\n' + sourceMappingURL
    } catch (error: any) {
      logger.error(`Failed to rewrite source maps: "${filename}"`, { error })
    }
  }

  return code
}

function loadSourceMap(file: string) {
  try {
    const source = fs.readFileSync(file, 'utf8')
    return parseSourceMap(source, path.dirname(file))
  } catch {}
}

function parseSourceMap(source: string, sourceRoot: string) {
  try {
    const sourceMap =
      convertSourceMap.fromSource(source) ||
      convertSourceMap.fromMapFileSource(source, sourceRoot)
    if (sourceMap) {
      const rawSourceMap = sourceMap.toObject()
      rawSourceMap.sourceRoot = sourceRoot
      return rawSourceMap
    }
  } catch {}
}
