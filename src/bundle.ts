import * as babel from '@babel/core'
import { dataToEsm } from '@rollup/pluginutils'
import builtins from 'builtin-modules'
import esModuleLexer from 'es-module-lexer'
import fs from 'fs'
import kleur from 'kleur'
import md5Hex from 'md5-hex'
import { warnOnce } from 'misty'
import path from 'path'
import { getBabelConfig, MagicString, t } from './babel'
import { ClientImport, generateClientModules } from './bundle/clients'
import { createModuleProvider, ModuleProvider } from './bundle/moduleProvider'
import type { RuntimeConfig } from './bundle/runtime/config'
import type { ClientModuleMap } from './bundle/runtime/modules'
import {
  ClientFunction,
  ClientFunctions,
  endent,
  extractClientFunctions,
  generateRoutePaths,
  loadContext,
  RegexParam,
  SausContext,
} from './core'
import { setRoutesModule } from './core/global'
import { vite } from './core/vite'
import { renderPlugin } from './plugins/render'
import { Profiling } from './profiling'
import { serializeImports } from './utils/imports'

const runtimeDir = path.resolve(__dirname, '../src/bundle/runtime')

export interface BundleOptions {
  outFile?: string
  minify?: boolean
}

export async function bundle(options: BundleOptions) {
  const context = await loadContext('build', undefined, [renderPlugin])

  const outDir = context.config.build?.outDir || 'dist'
  const bundlePath = options.outFile
    ? path.resolve(options.outFile)
    : context.serverPath &&
      path.resolve(
        context.root,
        context.serverPath
          .replace(/^(\.\/)?src\//, outDir + '/')
          .replace(/\.ts$/, '.js')
      )

  if (!bundlePath) {
    return context.logger.error(
      kleur.red(`[saus] Must provide a destination path`)
    )
  }

  const { functions, functionImports, routeImports, runtimeConfig } =
    await prepareFunctions(context)

  Profiling.mark('generate client modules')
  const moduleMap = await generateClientModules(
    functions,
    functionImports,
    runtimeConfig,
    context.config,
    options
  )

  Profiling.mark('generate ssr bundle')
  const bundle = await generateBundle(
    context,
    runtimeConfig,
    routeImports,
    functions,
    moduleMap
  )

  context.logger.info(
    kleur.bold('[saus]') +
      ` Saving bundle as ${kleur.green(relativeToCwd(bundlePath))}`
  )

  fs.mkdirSync(path.dirname(bundlePath), { recursive: true })
  fs.writeFileSync(bundlePath, bundle.code)

  if (!context.serverPath) {
    fs.copyFileSync(
      path.resolve(__dirname, '../src/bundle/types.ts'),
      bundlePath.replace(/(\.js)?$/, '.d.ts')
    )
  }
}

async function getBuildTransform(config: vite.UserConfig) {
  const resolvedConfig = await vite.resolveConfig(config, 'build')
  const context = await vite.createTransformContext(resolvedConfig, false)
  return [vite.createTransformer(context), context] as const
}

async function prepareFunctions(context: SausContext) {
  const { root, renderPath } = context

  Profiling.mark('parse render functions')
  const functions = extractClientFunctions(renderPath)
  Profiling.mark('transform render functions')

  const functionExt = path.extname(renderPath)
  const functionModules = createModuleProvider()
  const functionImports: { [stmt: string]: ClientImport } = {}

  const [transform, { config, pluginContainer }] = await getBuildTransform(
    vite.mergeConfig(context.config, {
      plugins: [functionModules],
    })
  )

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
  for (const { imports } of config.saus?.clients || []) {
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

  let cacheDir = config.saus?.cacheDir!
  cacheDir ??= cacheDir !== undefined ? '' : '.cache'

  const runtimeConfig: RuntimeConfig = {
    base: config.base,
    assetsDir: config.build.assetsDir,
    cacheDir,
  }

  return {
    functions,
    functionImports,
    implicitImports,
    routeImports,
    runtimeConfig,
  }
}

function serializeToEsm(data: unknown) {
  return dataToEsm(data, { indent: '  ', namedExports: false })
}

async function generateBundle(
  context: SausContext,
  runtimeConfig: RuntimeConfig,
  routeImports: RouteImports,
  functions: ClientFunctions,
  moduleMap: ClientModuleMap
) {
  const modules = createModuleProvider()

  modules.addModule({
    id: path.join(runtimeDir, 'functions.ts'),
    code: serializeToEsm(functions),
  })

  modules.addModule({
    id: path.join(runtimeDir, 'modules.ts'),
    code: serializeToEsm(moduleMap),
  })

  let knownPaths: Promise<string> | undefined
  modules.addModule({
    id: path.join(runtimeDir, 'paths.ts'),
    get code() {
      return (knownPaths ||= generateKnownPaths(context).then(serializeToEsm))
    },
  })

  modules.addModule({
    id: path.join(runtimeDir, 'config.ts'),
    code: serializeToEsm(runtimeConfig),
  })

  const entryId = path.resolve('.saus/main.js')
  modules.addModule({
    id: entryId,
    code: endent`
      import "/@fs/${context.renderPath}"
      import "/@fs/${context.routesPath}"
      import renderPage from "/@fs/${path.join(runtimeDir, 'main.ts')}"
      export default renderPage
    `,
    moduleSideEffects: 'no-treeshake',
  })

  const redirectedModules = [
    redirectModule('saus', path.join(runtimeDir, 'index.ts')),
    redirectModule('saus/core', path.join(runtimeDir, 'core.ts')),
    redirectModule('saus/bundle', entryId),
    redirectModule(
      path.resolve(__dirname, '../src/core/global.ts'),
      path.join(runtimeDir, 'global.ts')
    ),
    redirectModule('debug', path.join(runtimeDir, 'debug.ts')),
  ]

  const overrides: vite.UserConfig = {
    plugins: [
      modules,
      rewriteRouteImports(context.routesPath, routeImports, modules),
      ...redirectedModules,
      // debugSymlinkResolver(),
    ],
    ssr: {
      external: builtins as string[],
      noExternal: /.+/,
    },
    build: {
      ssr: true,
      write: false,
      rollupOptions: {
        input: context.serverPath
          ? path.resolve(context.root, context.serverPath)
          : entryId,
      },
    },
  }

  const config: vite.UserConfig = vite.mergeConfig(context.config, overrides)
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
      ...Array.from(
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
          map: s.generateMap(),
        }
      }
    },
  }
}

// @ts-ignore
function debugSymlinkResolver(): vite.Plugin {
  return {
    name: 'debugSymlinkResolver',
    configResolved(config) {
      const { symlinkResolver } = config
      this.generateBundle = () => {
        console.log('cacheSize: %O', symlinkResolver.cacheSize)
        console.log('cacheHits: %O', symlinkResolver.cacheHits)
        console.log('fsCalls:   %O', symlinkResolver.fsCalls)
      }
    },
  }
}

function relativeToCwd(file: string) {
  file = path.relative(process.cwd(), file)
  return file.startsWith('../') ? file : './' + file
}

function generateKnownPaths(context: SausContext) {
  const { bundleRequire } =
    require('bundle-require') as typeof import('bundle-require')

  setRoutesModule(context)
  return bundleRequire({
    filepath: context.routesPath,
    external: ['saus'],
    cwd: context.root,
  }).then(async () => {
    setRoutesModule(null)

    const paths: string[] = []
    const errors: { reason: string; path: string }[] = []
    await generateRoutePaths(context, {
      path(path, params) {
        paths.push(params ? RegexParam.inject(path, params) : path)
      },
      error: error => errors.push(error),
    })

    for (const error of errors) {
      context.logger.error(kleur.red(error.reason))
    }

    return paths
  })
}
