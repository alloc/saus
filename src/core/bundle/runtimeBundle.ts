import builtinModules from 'builtin-modules'
import * as esbuild from 'esbuild'
import path from 'path'
import { CompileCache } from '../../utils/CompileCache'
import {
  resolveMapSources,
  SourceMap,
  toInlineSourceMap,
} from '../../utils/sourceMap'
import { SausContext } from '../context'
import { bundleDir } from '../paths'
import { vite } from '../vite'

const sausRoot = path.resolve(__dirname, '../src') + '/'

const sausVersion = sausRoot.includes('/node_modules/')
  ? require(path.resolve(sausRoot, '../package.json')).version
  : require('child_process').execSync('git rev-list --no-merges -n 1 HEAD', {
      cwd: path.dirname(sausRoot),
    })

// These modules are dynamically defined at build time.
const sausExternals = [
  'core/http.ts',
  'bundle/runtime/clientModules.ts',
  'bundle/runtime/config.ts',
  'bundle/runtime/debugBase.ts',
  'bundle/runtime/functions.ts',
]

// These imports are handled by Rollup.
const bareExternals = [...builtinModules, 'debug']

export async function preBundleSsrRuntime(
  context: SausContext,
  plugins: vite.PluginOption[]
): Promise<vite.Plugin> {
  const entries = [
    path.join(bundleDir, 'index.ts'),
    path.join(bundleDir, 'core.ts'),
    path.join(bundleDir, 'main.ts'),
  ]

  const cache = new CompileCache('dist/.runtime', path.dirname(sausRoot))
  const cacheKeys = entries.map(entry =>
    cache.key(sausVersion, path.basename(entry, '.ts'))
  )

  const loaded = cacheKeys.map(key => cache.get(key))
  if (!loaded.every(Boolean)) {
    const config = await context.resolveConfig('build', { plugins })
    const { pluginContainer } = await vite.createTransformContext(config)

    const markSausExternals: esbuild.Plugin = {
      name: 'markSausExternals',
      setup(build) {
        build.onResolve({ filter: /.+/ }, async ({ path: id, importer }) => {
          if (bareExternals.includes(id)) {
            return { path: id, external: true }
          }
          const resolved = await pluginContainer.resolveId(id, importer)
          if (!resolved || !resolved.id.startsWith(sausRoot)) {
            return
          }
          const moduleId = path.relative(sausRoot, resolved.id)
          if (sausExternals.includes(moduleId)) {
            return {
              path: path.relative(cache.path, resolved.id),
              external: true,
            }
          }
          return {
            path: resolved.id,
          }
        })
      },
    }

    const { outputFiles } = await esbuild.build({
      entryPoints: entries,
      bundle: true,
      write: false,
      format: 'esm',
      target: 'esnext',
      splitting: true,
      sourcemap: 'external',
      outdir: cache.path,
      plugins: [markSausExternals],
    })

    await pluginContainer.close()

    for (let i = 1; i < outputFiles.length; i += 2) {
      const map = JSON.parse(outputFiles[i - 1].text) as SourceMap
      resolveMapSources(map, cache.path)
      delete map.sourcesContent

      const file = outputFiles[i]
      const code = file.text + toInlineSourceMap(map)

      const entryIndex = Math.floor(i / 2)
      if (entryIndex < entries.length) {
        const cacheKey = cacheKeys[entryIndex]
        cache.set(cacheKey, (loaded[entryIndex] = code))
      } else {
        const cacheKey = path.relative(cache.path, file.path)
        cache.set(cacheKey, code)
      }
    }
  }

  const cacheDir = cache.path + '/'
  return {
    name: 'saus:bundleSaus',
    enforce: 'pre',
    resolveId(id, importer) {
      if (!importer || !entries.includes(importer)) {
        return
      }
      if (id[0] == '.') {
        return path.resolve(cacheDir, id)
      }
    },
    load(id) {
      const entryIndex = entries.indexOf(id)
      if (entryIndex >= 0) {
        return loaded[entryIndex]
      }
      const cacheKey = id.replace(cacheDir, '')
      if (id !== cacheKey) {
        return cache.get(cacheKey)
      }
    },
  }
}
