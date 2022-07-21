import builtinModules from 'builtin-modules'
import * as esbuild from 'esbuild'
import path from 'path'
import type { BundleContext } from '../../bundle'
import { toInlineSourceMap } from '../node/sourceMap'
import { vite } from '../vite'
import { compileModule } from './compileModule'
import { getViteFunctions } from './functions'

/**
 * If you want to bundle some modules with Esbuild (instead of Rollup)
 * but you also want to use Vite plugins, this function can help.
 */
export async function esbuildViteBridge(
  context: BundleContext
): Promise<esbuild.Plugin> {
  const config = await context.resolveConfig({
    plugins: context.bundlePlugins,
  })

  const moduleOverrideByPath: Record<string, string> = {}
  const moduleOverrides: Record<string, string> = {
    debug: 'export default () => () => {}',
  }

  const pluginContainer = await vite.createPluginContainer(config)
  const { resolveId, ...compiler } = getViteFunctions(pluginContainer)

  return {
    name: 'vite-bridge',
    setup(build) {
      build.onStart(() => pluginContainer.buildStart({}))
      build.onEnd(() => pluginContainer.close())

      build.onResolve({ filter: /.+/ }, async ({ path: id, importer }) => {
        if (!importer) {
          return { path: id }
        }
        if (builtinModules.includes(id)) {
          return { path: id, external: true, sideEffects: false }
        }
        let resolved = await resolveId(id, importer)
        if (resolved) {
          if (typeof resolved == 'string') {
            resolved = { id: resolved }
          }
          if (moduleOverrides[id]) {
            moduleOverrideByPath[resolved.id] = moduleOverrides[id]
          }
          return {
            path: resolved.id,
            sideEffects: !!resolved.moduleSideEffects,
          }
        }
      })

      build.onLoad({ filter: /.+/ }, async ({ path: id }) => {
        if (moduleOverrideByPath[id]) {
          return {
            contents: moduleOverrideByPath[id],
            loader: 'js',
          }
        }
        const script = await compileModule(id, compiler)
        if (script) {
          let { code, map } = script
          if (map) {
            map.sources = map.sources.map(source => {
              return source ? path.relative(path.dirname(id), source) : null!
            })
            code += map ? toInlineSourceMap(map) : ''
          }
          return {
            contents: code,
            loader: 'js',
          }
        }
      })
    },
  }
}
