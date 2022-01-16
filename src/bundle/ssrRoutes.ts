import createDebug from 'debug'
import esModuleLexer from 'es-module-lexer'
import * as esbuild from 'esbuild'
import escalade from 'escalade/sync'
import { startTask } from 'misty/task'
import fs from 'fs'
import MagicString from 'magic-string'
import { dirname, isAbsolute, relative, resolve } from 'path'
import { getBabelProgram, getImportDeclarations, NodePath, t } from '../babel'
import { SausContext, vite } from '../core'
import { dedupe } from '../utils/dedupe'
import { esmExportsToCjs } from '../utils/esmToCjs'
import { runtimeDir } from './constants'
import { createModuleProvider, ModuleProvider } from './moduleProvider'

const debug = createDebug('saus:ssr')

export type RouteImports = Map<
  esModuleLexer.ImportSpecifier,
  { file: string; url: string }
>

export async function resolveRouteImports(
  { root, routesPath }: SausContext,
  pluginContainer: vite.PluginContainer
): Promise<RouteImports> {
  const routeImports: RouteImports = new Map()

  const code = fs.readFileSync(routesPath, 'utf8')
  for (const imp of esModuleLexer.parse(code, routesPath)[0]) {
    if (imp.d >= 0) {
      const resolved = await pluginContainer.resolveId(imp.n!, routesPath)
      if (resolved && !resolved.external) {
        routeImports.set(imp, {
          file: resolved.id,
          url: getResolvedUrl(root, resolved.id),
        })
      }
    }
  }

  return routeImports
}

function getResolvedUrl(root: string, resolvedId: string) {
  if (resolvedId[0] === '\0' || resolvedId.startsWith('/@fs/')) {
    return resolvedId
  }
  const relativeId = relative(root, resolvedId)
  return relativeId.startsWith('..') ? '/@fs/' + resolvedId : '/' + relativeId
}

const ssrModulesUrl = '/@fs/' + resolve(runtimeDir, '../ssrModules.ts')

export const toBundleChunkId = (id: string) =>
  id.replace(/\.[^.]+$/, '.bundle.js')

export async function bundleRoutes(
  routeImports: RouteImports,
  context: SausContext,
  isCommonJS: boolean
): Promise<vite.Plugin> {
  const { config } = context
  const modules = createModuleProvider()

  const [transform, { pluginContainer }] = await getBuildTransform({
    ...config,
    plugins: [
      modules,
      rewriteRouteImports(context.routesPath, routeImports, modules),
      ...config.plugins.filter(p => {
        // CommonJS modules are externalized, so this plugin is just overhead.
        return p.name !== 'commonjs'
      }),
    ],
    build: {
      ...config.build,
      sourcemap: 'inline',
      ssr: true,
      target: 'esnext',
    },
    ssr: {
      ...config.ssr,
      noExternal: [],
      external: [],
    },
  })

  // Some plugins rely on this hook (like vite:css)
  await pluginContainer.buildStart({})

  const sausExternalRE = /\bsaus(?!.*\/(runtime|examples))\b/
  const nodeModulesRE = /\/node_modules\//

  // const NULL_BYTE_PLACEHOLDER = `__x00__`
  const isVirtual = (id: string) => id[0] === '\0'
  const resolveVirtual = (id: string) => ({
    // Replace the null byte so it's visible in compiled code
    // when esbuild prepends the filename of the inlined module.
    path: id, // id.replace('\0', NULL_BYTE_PLACEHOLDER),
    namespace: 'virtual',
  })

  const shouldResolve = (id: string, importer: string) => {
    if (!/^[\w@]/.test(id)) {
      return true
    }
    const pkgId = 'package.json'
    // TODO: cache this lookup to reduce I/O (try to use Vite cache)
    let pkgPath = escalade(dirname(importer), (parent, children) => {
      if (parent == config.root) {
        return pkgId
      }
      return children.find(name => name == pkgId)
    })
    // Be careful not to leave unresolved imports that rely on
    // package.json files deep within the project root, because
    // Rollup will try (and fail) to resolve them using the
    // project root as the base directory.
    pkgPath = pkgPath && relative(config.root, dirname(pkgPath))
    if (pkgPath && /[^.]/.test(pkgPath[0])) {
      return true
    }
    // We let Rollup resolve imports by project files, so the
    // module provider created in `generateSsrBundle` is used.
    return !importer.startsWith(config.root + '/')
  }

  // This plugin bridges Esbuild and Vite.
  const bridge: esbuild.Plugin = {
    name: 'vite-bridge',
    setup(build) {
      build.onResolve({ filter: /.+/ }, async ({ path, importer }) => {
        if (!importer) {
          return { path }
        }
        if (sausExternalRE.test(path)) {
          return { path, external: true }
        }
        if (!shouldResolve(path, importer)) {
          return { path, external: true }
        }
        const resolved = await pluginContainer.resolveId(
          path,
          importer,
          undefined,
          true
        )
        if (resolved) {
          if (resolved.id == '__vite-browser-external') {
            debug('Externalized %O due to %O', path, resolved.id)
            return { path, external: true }
          }

          path = resolved.id

          if (isVirtual(path)) {
            return resolveVirtual(path)
          }

          const sideEffects =
            resolved.moduleSideEffects != null
              ? !!resolved.moduleSideEffects
              : undefined

          // TODO: handle "relative" and "absolute" external values
          const external =
            !!resolved.external ||
            !path.startsWith(config.root + '/') ||
            nodeModulesRE.test(path.slice(config.root.length))

          // Prepend /@fs/ for faster resolution by Rollup.
          if (external && isAbsolute(path)) {
            path = '/@fs/' + path
          }

          return {
            path,
            external,
            sideEffects,
          }
        }
        if (path.endsWith('.node')) {
          return { path, external: true }
        }
      })

      build.onLoad({ filter: /.+/ }, loadModule)
      build.onLoad({ filter: /.+/, namespace: 'virtual' }, args => {
        // args.path = args.path.replace(NULL_BYTE_PLACEHOLDER, '\0')
        return loadModule(args)
      })

      async function loadModule({
        path,
      }: esbuild.OnLoadArgs): Promise<esbuild.OnLoadResult | null | undefined> {
        const url = getResolvedUrl(config.root, path)
        const transformed = await transform(url)
        if (transformed) {
          return {
            contents: transformed.code,
            loader: 'js',
          }
        }
      }
    },
  }

  const task = startTask(`Bundling routes...`)

  const routeEntryPoints = dedupe(
    Array.from(routeImports.values(), resolved => resolved.file)
  )

  const { metafile, outputFiles } = await esbuild.build({
    absWorkingDir: config.root,
    bundle: true,
    entryPoints: [context.routesPath, context.renderPath, ...routeEntryPoints],
    format: 'esm',
    logLevel: 'error',
    metafile: true,
    outdir: config.root,
    plugins: [bridge],
    target: 'esnext',
    treeShaking: true,
    sourcemap: 'inline',
    splitting: true,
    write: false,
  })

  await pluginContainer.close()

  task.finish(`${routeEntryPoints.length} routes bundled.`)

  const routesUrl = getResolvedUrl(config.root, context.routesPath)
  const renderUrl = getResolvedUrl(config.root, context.renderPath)
  const entryUrlToFileMap: Record<string, string> = {
    [routesUrl]: context.routesPath,
    [renderUrl]: context.renderPath,
    ...Object.fromEntries(
      Array.from(routeImports.values(), resolved => [
        resolved.url,
        resolved.file,
      ])
    ),
  }

  const bundleToEntryMap: Record<string, string> = {}
  const bundledRoutes: Record<string, string> = {}
  const sharedModules: Record<string, string> = {}

  const outputs = Object.values(metafile!.outputs)
  for (let i = 0; i < outputFiles.length; i++) {
    const file = outputFiles[i]
    const { entryPoint } = outputs[i]
    if (entryPoint) {
      const entryUrl = '/' + entryPoint
      const filePath = entryUrlToFileMap[entryUrl]
      const bundleId = toBundleChunkId(filePath)
      bundledRoutes[bundleId] = file.text
      bundleToEntryMap[bundleId] = entryUrl
    } else {
      const chunkId = file.path.slice(config.root.length + 1)
      sharedModules['\0' + chunkId] = file.text
    }
  }

  return {
    name: 'saus:bundleRoutes',
    enforce: 'pre',
    resolveId(id) {
      if (sharedModules[id]) {
        return id
      }
      id = toBundleChunkId(id)
      if (bundledRoutes[id]) {
        return id
      }
    },
    load(id) {
      return bundledRoutes[id] || sharedModules[id]
    },
    transform(code, id) {
      if (bundledRoutes[id] || sharedModules[id]) {
        const editor = new MagicString(code)
        const program = getBabelProgram(code, id)
        const imports = getImportDeclarations(program)
        const lastImport = hoistImports(imports, editor)
        const lastImportEnd = lastImport ? lastImport.node.end! + 1 : 0

        const relativePathRE = /^(?:\.\/|(\.\.\/)+)/
        const requireCalls: string[] = []
        for (const { node } of imports) {
          const source = node.source.value
          if (!relativePathRE.test(source)) {
            continue
          }
          const validSource = JSON.stringify(
            '\0' + source.replace(relativePathRE, '')
          )

          const bindings: string[] = []
          for (const spec of node.specifiers) {
            if (t.isImportNamespaceSpecifier(spec)) {
              requireCalls.push(
                `const { ...${spec.local.name} } = await require(${validSource}); ` +
                  `delete ${spec.local.name}.default;\n`
              )
            } else {
              bindings.push(
                t.isImportDefaultSpecifier(spec)
                  ? `default: ${spec.local.name}`
                  : spec.imported.start == spec.local.start
                  ? spec.local.name
                  : t.isIdentifier(spec.imported)
                  ? `${spec.imported.name}: ${spec.local.name}`
                  : `["${spec.imported.value.replace(/"/g, '\\"')}"]: ` +
                    spec.local.name
              )
            }
          }

          if (bindings.length) {
            const list = bindings.join(', ')
            requireCalls.push(
              `const { ${list} } = await require(${validSource});\n`
            )
          } else if (!node.specifiers.length) {
            requireCalls.push(`await require(${validSource});\n`)
          }

          // Rewrite the import source, so `sharedModules` is accessed properly.
          editor.overwrite(node.source.start!, node.source.end!, validSource)

          // Remove import specifiers, since we only need the side effect
          // of the `__d` call to enable access via `require` function.
          editor.remove(node.start! + 'import '.length, node.source.start!)
        }

        esmExportsToCjs(program, editor)
        editor.prepend(`import { __d } from "${ssrModulesUrl}"\n`)
        const url = bundleToEntryMap[id] || id
        if (url == routesUrl) {
          const routeModulePaths = new Set(
            Array.from(routeImports.values(), resolved => resolved.file)
          )
          for (const file of routeModulePaths) {
            editor.prepend(`import "${file}"\n`)
          }
        }
        if (!isCommonJS && (url == routesUrl || url == renderUrl)) {
          editor.appendRight(lastImportEnd, `await `)
          editor.append('\n})()')
        } else {
          editor.appendRight(lastImportEnd, `export default `)
          editor.append('\n})')
        }
        editor.appendRight(
          lastImportEnd,
          `__d("${url}", async (exports, require) => {\n` +
            requireCalls.join('')
        )

        return {
          code: editor.toString(),
          map: editor.generateMap(),
          moduleSideEffects: 'no-treeshake',
        }
      }
    },
  }
}

async function getBuildTransform(config: vite.ResolvedConfig) {
  const context = await vite.createTransformContext(config, false)
  return [vite.createTransformer(context), context] as const
}

function hoistImports(
  imports: NodePath<t.ImportDeclaration>[],
  editor: MagicString
) {
  const importIdx = imports.findIndex(({ node }, i) => {
    const nextImport = imports[i + 1]
    return !nextImport || nextImport.node.start! - node.end! > 2
  })
  const hoistEndIdx = importIdx < 0 ? 0 : 1 + imports[importIdx].node.end!
  for (let i = importIdx + 1; i < imports.length; i++) {
    const { start, end } = imports[i].node
    // Assume import statements always end in a line break.
    editor.move(start!, 1 + end!, hoistEndIdx)
  }
  return imports[importIdx]
}

function rewriteRouteImports(
  routesPath: string,
  routeImports: RouteImports,
  modules: ModuleProvider
): vite.Plugin {
  return {
    name: 'saus:rewriteRouteImports',
    enforce: 'pre',
    async transform(code, id) {
      if (id === routesPath) {
        const s = new MagicString(code, {
          filename: routesPath,
          indentExclusionRanges: [],
        })
        s.prepend(`import { ssrRequire } from "${ssrModulesUrl}"\n`)
        for (const [imp, resolved] of routeImports.entries()) {
          s.overwrite(imp.s + 1, imp.e - 1, resolved.url)
          s.overwrite(imp.d, imp.d + 6, 'ssrRequire')
        }
        return {
          code: s.toString(),
          map: s.generateMap({ hires: true }),
          moduleSideEffects: 'no-treeshake',
        }
      }
    },
  }
}
