import builtinModules from 'builtin-modules'
import * as esModuleLexer from 'es-module-lexer'
import * as esbuild from 'esbuild'
import path from 'path'
import { runtimeDir } from '../bundle/constants'
import { CompileCache } from '../utils/CompileCache'
import { SausContext } from './context'
import { vite } from './vite'

const sausRoot = path.resolve(__dirname, '../src') + '/'

// These modules are dynamically defined at build time.
const sausExternals = [
  'core/http.ts',
  'bundle/runtime/config.ts',
  'bundle/runtime/functions.ts',
  'bundle/runtime/modules.ts',
  'bundle/runtime/debugBase.ts',
]

// These imports are handled by Rollup.
const bareExternals = [...builtinModules, 'debug']

export async function preBundleSsrRuntime(
  context: SausContext,
  plugins: vite.PluginOption[]
): Promise<vite.Plugin> {
  const entries = [
    path.join(runtimeDir, 'index.ts'),
    path.join(runtimeDir, 'core.ts'),
    path.join(runtimeDir, 'main.ts'),
  ]

  const cache = new CompileCache('dist/.runtime', path.dirname(sausRoot))
  const cacheKeys = entries.map(cache.key)

  const loaded = cacheKeys.map(key => cache.get(key))
  // const loaded = cacheKeys.map(key => null as string | null)
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
            return { path: `saus/src/${moduleId}`, external: true }
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

    const external = new Set<string>()
    for (let i = 1; i < outputFiles.length; i += 2) {
      const file = outputFiles[i]
      for (const imp of esModuleLexer.parse(file.text)[0]) {
        if (imp.n && imp.n[0] !== '.') {
          external.add(imp.n)
        }
      }
      const entryIndex = Math.floor(i / 2)
      if (entryIndex < entries.length) {
        const cacheKey = cacheKeys[entryIndex]
        cache.set(cacheKey, (loaded[entryIndex] = file.text))
      } else {
        const cacheKey = path.relative(cache.path, file.path)
        cache.set(cacheKey, file.text)
      }
    }
  }

  return {
    name: 'saus:bundleSaus',
    enforce: 'pre',
    resolveId(id, importer) {
      if (!importer || !entries.includes(importer)) {
        return
      }
      if (id[0] == '.') {
        return path.resolve(cache.path, id)
      }
    },
    load(id) {
      const entryIndex = entries.indexOf(id)
      if (entryIndex >= 0) {
        return loaded[entryIndex]
      }
      const cacheKey = id.replace(cache.path + '/', '')
      if (id !== cacheKey) {
        return cache.get(cacheKey)
      }
    },
  }
}
