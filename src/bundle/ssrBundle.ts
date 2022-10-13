import { MagicString } from '@/babel'
import { debug } from '@/debug'
import { bundleDir, clientDir, httpDir } from '@/paths'
import { rewriteHttpImports } from '@/plugins/httpImport'
import { overrideBareImport, redirectModule } from '@/plugins/moduleRedirection'
import { copyPublicDir } from '@/plugins/publicDir'
import { routesPlugin } from '@/plugins/routes'
import { BundleConfig, vite } from '@/vite'
import { resolveMapSources } from '@utils/node/sourceMap'
import arrify from 'arrify'
import builtinModules from 'builtin-modules'
import esModuleLexer from 'es-module-lexer'
import fs from 'fs'
import kleur from 'kleur'
import path from 'path'
import { BundleContext } from '../bundle'
import { IsolatedModuleMap } from './isolateRoutes'
import type { BundleOptions } from './options'
import { preferExternal } from './preferExternal'
import { renderBundleModule } from './renderBundleModule'

export async function compileServerBundle(
  ssrEntryId: string,
  context: BundleContext,
  options: BundleOptions,
  isolatedModules: IsolatedModuleMap,
  inlinePlugins: vite.PluginOption[]
) {
  const { bundle: bundleConfig, injectedModules } = context

  if (bundleConfig.clientStore !== 'external')
    injectedModules.addServerModule({
      id: path.join(bundleDir, 'bundle/clientStore/index.ts'),
      code: `export * from "./${bundleConfig.clientStore}"`,
    })

  if (!bundleConfig.debugBase)
    injectedModules.addServerModule({
      id: path.join(bundleDir, 'bundle/debugBase.ts'),
      code: `export function injectDebugBase() {}`,
    })

  injectedModules.addServerModule({
    id: context.bundleModuleId,
    code: renderBundleModule(ssrEntryId),
    moduleSideEffects: 'no-treeshake',
  })

  // Avoid using Node built-ins for `get` function.
  const isWorker = bundleConfig.type == 'worker'
  const workerPlugins: vite.PluginOption[] = []
  if (isWorker) {
    workerPlugins.push(
      redirectModule(
        path.join(httpDir, 'get.ts'),
        path.join(clientDir, 'http/get.ts')
      ),
      // Redirect the `debug` package to a stub module.
      !options.isBuild &&
        overrideBareImport('debug', path.join(bundleDir, 'bundle/debug.ts'))
    )
  }

  const bundleOutDir = bundleConfig.outFile
    ? path.dirname(bundleConfig.outFile)
    : context.root

  const preferExternalPlugin =
    (options.preferExternal || undefined) && preferExternal(context)

  debug('Resolving "build" config for SSR bundle')
  const config = await context.resolveConfig({
    plugins: [
      context.bundlePlugins,
      ...inlinePlugins,
      injectedModules,
      options.absoluteSources && mapSourcesPlugin(bundleOutDir),
      ...workerPlugins,
      copyPublicDir(),
      routesPlugin(),
      preferExternalPlugin,
      bundleConfig.type == 'worker' && defineNodeConstants(),
      rewriteHttpImports(context.logger, isWorker),
      bundleConfig.entry &&
      bundleConfig.type == 'script' &&
      !supportTopLevelAwait(bundleConfig)
        ? wrapAsyncInit()
        : null,
      // debugSymlinkResolver(),
    ],
    resolve: {
      conditions: ['ssr'].concat(isWorker ? ['worker'] : []),
    },
    build: {
      write: false,
      target: bundleConfig.target || 'node14',
      minify: bundleConfig.minify == true,
      sourcemap: context.userConfig.build?.sourcemap ?? true,
      rollupOptions: {
        input: bundleConfig.entry || context.bundleModuleId,
        output: {
          dir: bundleOutDir,
          format: bundleConfig.format,
        },
        context: 'globalThis',
        makeAbsoluteExternalsRelative: false,
        external: preferExternalPlugin
          ? (id, _importer, isResolved) => {
              if (!isResolved) return
              if (isolatedModules[id]) return
              if (!path.isAbsolute(id)) return
              if (fs.existsSync(id)) {
                const { external, msg } = preferExternalPlugin.isExternal(id)
                if (msg && !!process.env.DEBUG) {
                  const relativeId = path
                    .relative(context.root, id)
                    .replace(/^([^.])/, './$1')
                  debug(relativeId)
                  debug((external ? kleur.green : kleur.yellow)(`  ${msg}`))
                }
                return external
              }
            }
          : id => {
              return builtinModules.includes(id)
            },
      },
    },
  })

  if (!options.preferExternal) {
    config.ssr!.noExternal = /./
    config.ssr!.external = bundleConfig.external
  }

  const buildResult = (await vite.build(config)) as vite.ViteBuild
  const bundle = buildResult.output[0].output[0]

  return bundle
}

function mapSourcesPlugin(outDir: string): vite.Plugin {
  return {
    name: 'saus:mapSources',
    enforce: 'pre',
    generateBundle(_, chunks) {
      for (const chunk of Object.values(chunks)) {
        if (chunk.type == 'asset') continue
        if (chunk.map) {
          resolveMapSources(chunk.map, outDir)
        }
      }
    },
  }
}

function defineNodeConstants(): vite.Plugin {
  return {
    name: 'saus:defineNodeConstants',
    transform(code, id) {
      if (id.includes('/node_modules/')) {
        return
      }
      const constants: any = {
        __filename: JSON.stringify(id),
        __dirname: JSON.stringify(path.dirname(id)),
      }
      let matched = false
      let matches = new RegExp(
        `\\b(${Object.keys(constants).join('|')})\\b`,
        'g'
      )
      code = code.replace(matches, name => {
        matched = true
        return constants[name]
      })
      if (matched) {
        return { code, map: { mappings: '' } }
      }
    },
  }
}

// Technically, top-level await is available since Node 14.8 but Esbuild
// complains when this feature is used with a "node14" target environment.
function supportTopLevelAwait(bundleConfig: BundleConfig) {
  return (
    !bundleConfig.target ||
    arrify(bundleConfig.target).some(
      target => target.startsWith('node') && Number(target.slice(4)) >= 15
    )
  )
}

/**
 * Wrap the entire SSR bundle with an async IIFE, so top-level await
 * is possible in Node 14 and under.
 */
function wrapAsyncInit(): vite.Plugin {
  return {
    name: 'saus:wrapAsyncInit',
    enforce: 'pre',
    renderChunk(code) {
      const editor = new MagicString(code)

      const imports = esModuleLexer.parse(code)[0]
      const lastImportEnd = imports[imports.length - 1]?.se || 0
      const semiPrefix = code[lastImportEnd - 1] == ';' ? '' : ';'
      editor.appendRight(lastImportEnd, `\n${semiPrefix}(async () => {`)
      editor.append(`\n})()`)

      return {
        code: editor.toString(),
        map: editor.generateMap({ hires: true }),
      }
    },
  }
}
