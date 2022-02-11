import builtinModules from 'builtin-modules'
import * as esbuild from 'esbuild'
import path from 'path'
import { CompileCache } from '../../utils/CompileCache'
import { relativeToCwd } from '../../utils/relativeToCwd'
import {
  resolveMapSources,
  SourceMap,
  toInlineSourceMap,
} from '../../utils/sourceMap'
import { SausContext } from '../context'
import { bundleDir, httpDir } from '../paths'
import { vite } from '../vite'

const sausRoot = path.resolve(__dirname, '../src') + '/'
const cache = new CompileCache('dist/.runtime', path.dirname(sausRoot))

const sausVersion = sausRoot.includes('/node_modules/')
  ? require(path.resolve(sausRoot, '../package.json')).version
  : require('child_process').execSync('git rev-list --no-merges -n 1 HEAD', {
      cwd: path.dirname(sausRoot),
    })

// These modules are dynamically defined at build time.
const sausExternals = [
  'bundle/clientModules.ts',
  'bundle/config.ts',
  'bundle/debugBase.ts',
  'bundle/functions.ts',
  'bundle/routes.ts',
  'client/routes.ts',
]

// These imports are handled by Rollup.
const bareExternals = [...builtinModules, 'debug']

function buildEntryMap(entries: Record<string, string>) {
  const entryMap: Record<string, string> = {}
  for (const name in entries) {
    const key = removeExt(cache.key(sausVersion, name))
    entryMap[key] = entries[name]
  }
  return entryMap
}

export async function preBundleSsrRuntime(
  context: SausContext,
  plugins: vite.PluginOption[]
): Promise<vite.Plugin> {
  const entryMap = buildEntryMap({
    // "saus" entry point
    saus: path.join(bundleDir, 'index.ts'),
    // "saus/core" entry point
    core: path.join(bundleDir, 'core.ts'),
    // "saus/bundle" entry point
    bundle: path.join(bundleDir, 'main.ts'),
    // "saus/client" entry point
    client: path.join(bundleDir, 'clientEntry.ts'),
    // used by @saus/html
    html: path.join(bundleDir, 'html.ts'),
    // "saus/http" entry point
    http: path.join(httpDir, 'index.ts'),
  })

  let bundleInfo: RuntimeBundleInfo

  const entryPaths = Object.values(entryMap)
  const entryBundles = Object.keys(entryMap).map(key => cache.get(key + '.js'))

  if (entryBundles.every(Boolean)) {
    bundleInfo = JSON.parse(cache.get('_bundle.json')!)
  } else {
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
          if (!resolved) {
            return
          }

          const external =
            !resolved.id.startsWith(sausRoot) ||
            resolved.id.includes('/node_modules/')

          if (external) {
            return { path: id, external }
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

    const { outputFiles, metafile } = await esbuild.build({
      entryPoints: entryMap,
      metafile: true,
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

    bundleInfo = getBundleInfo(metafile!)
    cache.set('_bundle.json', JSON.stringify(bundleInfo, null, 2))

    for (let i = 1; i < outputFiles.length; i += 2) {
      const map = JSON.parse(outputFiles[i - 1].text) as SourceMap
      resolveMapSources(map, cache.path)
      delete map.sourcesContent

      const file = outputFiles[i]
      const code = file.text + toInlineSourceMap(map)

      const cacheKey = path.relative(cache.path, file.path)
      cache.set(cacheKey, code)

      const entryPath = entryMap[removeExt(cacheKey)]
      if (entryPath) {
        const entryIndex = entryPaths.indexOf(entryPath)
        entryBundles[entryIndex] = code
      }
    }
  }

  const cacheDir = cache.path + '/'
  return {
    name: 'saus:runtimeBundle',
    enforce: 'pre',
    async resolveId(id, importer) {
      if (!importer) {
        return
      }
      if (entryPaths.includes(importer)) {
        if (id[0] == '.') {
          return path.resolve(cacheDir, id)
        }
      } else if (!bundleInfo.files.includes(importer)) {
        const resolved = await this.resolve(id, importer, { skipSelf: true })
        if (
          !resolved ||
          entryPaths.includes(resolved.id) ||
          resolved.id.startsWith(cacheDir)
        ) {
          return resolved
        }
        if (bundleInfo.files.includes(resolved.id)) {
          this.warn(
            `"${relativeToCwd(resolved.id)}" is bundled ahead-of-time, ` +
              `so it shouldn't be imported by "${relativeToCwd(importer)}"`
          )
        }
      }
    },
    load(id) {
      const entryIndex = entryPaths.indexOf(id)
      if (entryIndex >= 0) {
        return entryBundles[entryIndex]
      }
      const cacheKey = id.replace(cacheDir, '')
      if (id !== cacheKey) {
        return cache.get(cacheKey)
      }
    },
  }
}

export interface RuntimeBundleInfo {
  entryMap: Record<string, string>
  files: string[]
}

function getBundleInfo(metafile: { outputs: Record<string, any> }) {
  const entryMap: Record<string, string> = {}
  const files: string[] = []
  for (const [outputPath, output] of Object.entries(metafile.outputs)) {
    if (outputPath.endsWith('.map')) continue
    if (output.entryPoint) {
      const entryPoint = path.resolve(output.entryPoint)
      entryMap[entryPoint] = path.resolve(outputPath)
    }
    for (const inputPath in output.inputs) {
      files.push(path.resolve(inputPath))
    }
  }
  return { entryMap, files }
}

function removeExt(file: string) {
  return file.replace(/\.[^.]+$/, '')
}
