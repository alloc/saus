import * as babel from '@babel/core'
import builtins from 'builtin-modules'
import esModuleLexer from 'es-module-lexer'
import fs from 'fs'
import kleur from 'kleur'
import md5Hex from 'md5-hex'
import { fatal, warnOnce } from 'misty'
import path from 'path'
import { getBabelConfig, MagicString, t } from './babel'
import { ClientImport, generateClientModules } from './bundle/clients'
import { createModuleProvider, ModuleProvider } from './bundle/moduleProvider'
import type { ClientModuleMap } from './bundle/runtime/modules'
import { SourceMap } from './bundle/sourceMap'
import {
  ClientFunction,
  ClientFunctions,
  dataToEsm,
  endent,
  extractClientFunctions,
  SausBundleConfig,
  SausContext,
} from './core'
import type { RuntimeConfig } from './core/config'
import { loadContext } from './core/context'
import { vite } from './core/vite'
import { debugForbiddenImports } from './plugins/debug'
import { renderPlugin } from './plugins/render'
import { Profiling } from './profiling'
import { callPlugins } from './utils/callPlugins'
import { dedupe } from './utils/dedupe'
import { parseImports, serializeImports } from './utils/imports'

const runtimeDir = path.resolve(__dirname, '../src/bundle/runtime')

export interface BundleOptions {
  absoluteSources?: boolean
  entry?: string | null
  format?: 'esm' | 'cjs'
  minify?: boolean
  mode?: string
  outFile?: string
  write?: boolean
}

export async function loadBundleContext(inlineConfig?: vite.UserConfig) {
  try {
    return await loadContext('build', inlineConfig, [renderPlugin])
  } catch (e: any) {
    if (e.message.startsWith('[saus]')) {
      fatal(e.message)
    }
    throw e
  }
}

export async function bundle(context: SausContext, options: BundleOptions) {
  const bundleConfig = context.config.saus.bundle || {}
  const bundleFormat = options.format || bundleConfig.format || 'cjs'

  let bundlePath = options.outFile ? path.resolve(options.outFile) : null!
  let bundleEntry =
    options.entry !== undefined ? options.entry : bundleConfig.entry

  const outDir = context.userConfig.build?.outDir || 'dist'
  if (bundleEntry) {
    bundlePath = path.resolve(
      context.root,
      bundleEntry
        .replace(/^(\.\/)?src\//, outDir + '/')
        .replace(/\.ts$/, bundleFormat == 'cjs' ? '.js' : '.mjs')
    )
    bundleEntry = path.resolve(context.root, bundleEntry)
  }

  const shouldWrite =
    options.write !== false && context.config.build.write !== false

  if (!bundlePath && shouldWrite) {
    throw Error(
      `[saus] The "outFile" option must be provided when ` +
        `"saus.bundle.entry" is not defined in your Vite config ` +
        `(and the "write" option is not false).`
    )
  }

  const { functions, functionImports, routeImports, runtimeConfig } =
    await prepareFunctions(context, options)

  Profiling.mark('generate client modules')
  const moduleMap = await generateClientModules(
    functions,
    functionImports,
    runtimeConfig,
    context,
    options
  )

  Profiling.mark('generate ssr bundle')
  const bundleDir = bundlePath ? path.dirname(bundlePath) : context.root
  const { code, map } = await generateBundle(
    context,
    runtimeConfig,
    routeImports,
    functions,
    moduleMap,
    bundleEntry,
    bundleConfig,
    bundleFormat,
    bundleDir
  )

  if (map && options.absoluteSources) {
    map.sources = map.sources.map(source => {
      return path.resolve(bundleDir, source)
    })
  }

  const bundle = {
    path: bundlePath,
    code,
    map: map as SourceMap | undefined,
  }

  if (shouldWrite) {
    await callPlugins(context.plugins, 'onWriteBundle', bundle)

    context.logger.info(
      kleur.bold('[saus]') +
        ` Saving bundle as ${kleur.green(relativeToCwd(bundle.path))}`
    )

    const mapFileComment =
      '\n//# ' + 'sourceMappingURL=' + path.basename(bundle.path) + '.map'

    fs.mkdirSync(path.dirname(bundle.path), { recursive: true })
    fs.writeFileSync(bundle.path, bundle.code + mapFileComment)
    fs.writeFileSync(bundle.path + '.map', JSON.stringify(bundle.map))

    if (!bundleConfig.entry) {
      fs.copyFileSync(
        path.resolve(__dirname, '../src/bundle/types.ts'),
        bundle.path.replace(/(\.[cm]js)?$/, '.d.ts')
      )
    }
  }

  return bundle
}

async function getBuildTransform(config: vite.ResolvedConfig) {
  const context = await vite.createTransformContext(config, false)
  return [vite.createTransformer(context), context] as const
}

async function prepareFunctions(context: SausContext, options: BundleOptions) {
  const { root, renderPath, config } = context

  Profiling.mark('parse render functions')
  const functions = extractClientFunctions(renderPath)
  Profiling.mark('transform render functions')

  const functionExt = path.extname(renderPath)
  const functionModules = createModuleProvider()
  const functionImports: { [stmt: string]: ClientImport } = {}

  const [transform, { pluginContainer }] = await getBuildTransform({
    ...config,
    plugins: [functionModules, ...config.plugins],
  })

  const babelConfig = getBabelConfig(renderPath)
  const parseFile = (code: string) =>
    babel.parseSync(code, babelConfig) as t.File
  const parseStmt = <T = t.Statement>(code: string) =>
    parseFile(code).program.body[0] as any as T

  const registerImport = async (code: string, node?: t.ImportDeclaration) => {
    if (functionImports[code]) return

    // Explicit imports have a Babel node parsed from the source file,
    // while implicit imports need their injected code to be parsed.
    const isImplicit = node == null

    if (!node) {
      node = parseStmt(code)!
      if (!t.isImportDeclaration(node)) {
        return warnOnce(`Expected an import declaration`)
      }
    }

    const id = node.source.value

    let resolvedId = (await pluginContainer.resolveId(id, renderPath))?.id
    if (!resolvedId) {
      return warnOnce(`Could not resolve "${id}"`)
    }

    const isRelativeImport = id[0] == '.'
    const inProjectRoot = resolvedId.startsWith(root + '/')

    if (isRelativeImport && !inProjectRoot) {
      return warnOnce(`Relative import "${id}" resolved outside project root`)
    }

    const isVirtual = id === resolvedId || resolvedId[0] === '\0'
    const resolved: ClientImport = {
      id,
      code,
      source: isVirtual
        ? resolvedId
        : inProjectRoot
        ? resolvedId.slice(root.length)
        : `/@fs/${resolvedId}`,
      isVirtual,
      isImplicit,
    }

    if (!isVirtual)
      resolved.code =
        code.slice(0, node.source.start! - node.start!) +
        `"${resolved.source}"` +
        code.slice(node.source.end! - node.start!)

    functionImports[code] = resolved
  }

  const transformFunction = async (fn: ClientFunction) => {
    const functionCode = [
      ...fn.referenced,
      `export default ` + fn.function,
    ].join('\n')

    const functionModule = functionModules.addModule({
      id: `function.${md5Hex(functionCode).slice(0, 8)}${functionExt}`,
      code: functionCode,
    })

    const transformResult = await transform(functionModule.id)
    if (transformResult?.code) {
      const [prelude, transformedFn] =
        transformResult.code.split('\nexport default ')

      fn.function = transformedFn.replace(/;\n?$/, '')
      fn.referenced = []

      for (const node of parseFile(prelude).program.body) {
        const code = prelude.slice(node.start!, node.end!)
        fn.referenced.push(code)
        if (t.isImportDeclaration(node)) {
          await registerImport(code, node)
        }
      }
    }
  }

  const implicitImports = new Set<string>()

  // The `onHydrate` function is used by every shared client module.
  implicitImports.add(`import { onHydrate as $onHydrate } from "saus/client"`)

  // The `hydrate` function is used by every inlined client module.
  implicitImports.add(`import { hydrate } from "saus/client"`)

  // Renderer packages often import modules that help with hydrating the page.
  for (const { imports } of config.saus.clients || []) {
    serializeImports(imports).forEach(stmt => implicitImports.add(stmt))
  }

  const routeImports = await resolveRouteImports(context, pluginContainer)

  // Every route has a module imported by the inlined client module.
  for (const url of routeImports.values()) {
    implicitImports.add(`import * as routeModule from "${url}"`)
  }

  await Promise.all([
    ...Array.from(implicitImports, stmt => registerImport(stmt)),
    ...functions.beforeRender.map(transformFunction),
    ...functions.render.map(renderFn =>
      Promise.all([
        transformFunction(renderFn),
        renderFn.didRender && transformFunction(renderFn.didRender),
      ])
    ),
  ])

  await pluginContainer.close()

  const bundleConfig = config.saus.bundle || {}
  const outDir = path.resolve(config.root, config.build.outDir)

  const runtimeConfig: RuntimeConfig = {
    assetsDir: config.build.assetsDir,
    base: config.base,
    bundleType: bundleConfig.type || 'script',
    command: 'bundle',
    defaultPath: context.defaultPath,
    minify: options.minify == true,
    mode: config.mode,
    publicDir: path.relative(outDir, config.publicDir),
    // Replaced by the `generateClientModules` function.
    stateCacheUrl: '',
  }

  // The functions are now transpiled to plain JavaScript.
  functions.filename = functions.filename.replace(/\.[^.]+$/, '.js')

  return {
    functions,
    functionImports,
    implicitImports,
    routeImports,
    runtimeConfig,
  }
}

async function generateBundle(
  context: SausContext,
  runtimeConfig: RuntimeConfig,
  routeImports: RouteImports,
  functions: ClientFunctions,
  moduleMap: ClientModuleMap,
  bundleEntry: string | null | undefined,
  bundleConfig: SausBundleConfig,
  bundleFormat: 'esm' | 'cjs',
  bundleDir: string
) {
  const modules = createModuleProvider()

  modules.addModule({
    id: path.join(runtimeDir, 'functions.ts'),
    code: dataToEsm(functions),
  })

  modules.addModule({
    id: path.join(runtimeDir, 'modules.ts'),
    code: dataToEsm(moduleMap),
  })

  const runtimeConfigModule = modules.addModule({
    id: path.join(runtimeDir, 'config.ts'),
    code: dataToEsm(runtimeConfig),
  })

  const pluginImports = new Set<string>()
  for (const plugin of context.plugins) {
    if (plugin.fetchBundleImports) {
      const imports = await plugin.fetchBundleImports(modules)
      imports?.forEach(source => pluginImports.add(source))
    }
  }

  const entryId = path.resolve('.saus/main.js')
  const runtimeId = `/@fs/${path.join(runtimeDir, 'main.ts')}`
  modules.addModule({
    id: entryId,
    code: endent`
      ${serializeImports(Array.from(pluginImports))}
      import "/@fs/${context.renderPath}"
      import "/@fs/${context.routesPath}"
      export * from "${runtimeId}"
      export {default} from "${runtimeId}"
      export {default as config} from "${runtimeConfigModule.id}"
    `,
    moduleSideEffects: 'no-treeshake',
  })

  const redirectedModules = [
    redirectModule('saus', path.join(runtimeDir, 'index.ts')),
    redirectModule('saus/core', path.join(runtimeDir, 'core.ts')),
    redirectModule('saus/bundle', entryId),
    redirectModule('saus/paths', path.join(runtimeDir, 'paths.ts')),
    redirectModule(
      path.resolve(__dirname, '../src/core/global.ts'),
      path.join(runtimeDir, 'global.ts')
    ),
    redirectModule(
      path.resolve(__dirname, '../src/client/cache.ts'),
      path.join(runtimeDir, 'context.ts')
    ),
    redirectModule('debug', path.join(runtimeDir, 'debug.ts')),
  ]

  const bundleType = bundleConfig.type || 'script'

  // Avoid using Node built-ins for `get` function.
  if (bundleType == 'worker') {
    redirectedModules.push(
      redirectModule(
        path.resolve(__dirname, '../src/core/http.ts'),
        path.join(runtimeDir, 'http.ts')
      )
    )
  }

  const config = await context.resolveConfig('build', {
    plugins: [
      debugForbiddenImports([
        'vite',
        './src/core/index.ts',
        './src/core/context.ts',
      ]),
      modules,
      bundleEntry && bundleType == 'script'
        ? transformServerScript(bundleEntry)
        : null,
      rewriteRouteImports(context.routesPath, routeImports, modules),
      ...redirectedModules,
      // debugSymlinkResolver(),
    ],
    ssr: {
      noExternal: /.+/,
    },
    build: {
      ssr: true,
      write: false,
      target: bundleConfig.target || 'node14',
      minify: bundleConfig.minify == true,
      sourcemap: true,
      rollupOptions: {
        input: bundleEntry || entryId,
        output: {
          dir: bundleDir,
          format: bundleFormat,
          sourcemapExcludeSources: true,
        },
      },
    },
  })

  // Externalize Node built-ins only.
  config.ssr!.external = builtins as string[]

  const buildResult = (await vite.build(config)) as vite.ViteBuild
  return buildResult.output[0].output[0]
}

function redirectModule(targetId: string, replacementId: string): vite.Plugin {
  return {
    name: 'redirect-module:' + targetId,
    enforce: 'pre',
    async resolveId(id, importer) {
      if (importer && id[0] === '.' && targetId[0] === '/') {
        id = (await this.resolve(id, importer, { skipSelf: true }))?.id!
      }
      if (id === targetId) {
        return replacementId
      }
    },
  }
}

type RouteImports = Map<esModuleLexer.ImportSpecifier, string>

async function resolveRouteImports(
  { root, routesPath }: SausContext,
  pluginContainer: vite.PluginContainer
): Promise<RouteImports> {
  const routeImports: RouteImports = new Map()

  const code = fs.readFileSync(routesPath, 'utf8')
  for (const imp of esModuleLexer.parse(code, routesPath)[0]) {
    if (imp.d >= 0) {
      const resolved = await pluginContainer.resolveId(imp.n!, routesPath)
      if (resolved) {
        const relativeId = path.relative(root, resolved.id)
        const resolvedUrl = relativeId.startsWith('..')
          ? '/@fs/' + resolved.id
          : '/' + relativeId

        routeImports.set(imp, resolvedUrl)
      }
    }
  }

  return routeImports
}

function rewriteRouteImports(
  routesPath: string,
  routeImports: RouteImports,
  modules: ModuleProvider
): vite.Plugin {
  modules.addModule({
    id: path.join(runtimeDir, 'routes.ts'),
    code: [
      `export default {`,
      ...dedupe(
        routeImports.values(),
        url => `  "${url}": () => import("${url}"),`
      ),
      `}`,
    ].join('\n'),
  })

  return {
    name: 'saus:rewriteRouteImports',
    enforce: 'pre',
    async transform(code, id) {
      if (id === routesPath) {
        const s = new MagicString(code, {
          filename: routesPath,
          indentExclusionRanges: [],
        })
        const importIdent = '__vite_ssr_dynamic_import__'
        s.prepend(
          `import ${importIdent} from "/@fs/${path.join(
            runtimeDir,
            'import.ts'
          )}"\n`
        )
        for (const [imp, resolvedUrl] of routeImports.entries()) {
          s.overwrite(imp.s + 1, imp.e - 1, resolvedUrl)
          s.overwrite(imp.d, imp.d + 6, importIdent)
        }
        return {
          code: s.toString(),
          map: s.generateMap({ hires: true }),
        }
      }
    },
  }
}

function relativeToCwd(file: string) {
  file = path.relative(process.cwd(), file)
  return file.startsWith('../') ? file : './' + file
}

/**
 * Wrap top-level statements in the `server` module with `setImmediate`
 * to avoid TDZ issues.
 */
function transformServerScript(serverPath: string): vite.Plugin {
  return {
    name: 'saus:transformServerScript',
    enforce: 'pre',
    transform(code, id) {
      if (id === serverPath) {
        const editor = new MagicString(code, {
          filename: id,
          indentExclusionRanges: [],
        })

        // 1. Hoist all imports not grouped with the first import
        const imports = parseImports(code)
        const importIdx = imports.findIndex(({ end }, i) => {
          const nextImport = imports[i + 1]
          return !nextImport || nextImport.start > end + 1
        })
        const hoistEndIdx = importIdx < 0 ? 0 : imports[importIdx].end + 1
        for (let i = importIdx + 1; i < imports.length; i++) {
          const { start, end } = imports[i]
          // Assume import statements always end in a line break.
          editor.move(start, end + 1, hoistEndIdx)
        }

        // 2. Wrap all statements below the imports
        editor.appendRight(hoistEndIdx, `\nsetImmediate(async () => {\n`)
        editor.append(`\n})`)

        return {
          code: editor.toString(),
          map: editor.generateMap(),
        }
      }
    },
  }
}
