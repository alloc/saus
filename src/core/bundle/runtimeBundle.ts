import remapping from '@ampproject/remapping'
import builtinModules from 'builtin-modules'
import * as esbuild from 'esbuild'
import fs from 'fs'
import path from 'path'
import { CompileCache } from '../../utils/CompileCache'
import { relativeToCwd } from '../../utils/relativeToCwd'
import {
  loadSourceMap,
  resolveMapSources,
  SourceMap,
} from '../../utils/sourceMap'
import { SausContext } from '../context'
import { bundleDir, clientDir, httpDir, toSausPath } from '../paths'
import { vite } from '../vite'

const sausRoot = toSausPath('src/')
const cache = new CompileCache('dist/.runtime', path.dirname(sausRoot))

const sausVersion = sausRoot.includes('/node_modules/')
  ? require(path.resolve(sausRoot, '../package.json')).version
  : require('child_process').execSync('git rev-list --no-merges -n 1 HEAD', {
      cwd: path.dirname(sausRoot),
    })

// These modules are dynamically defined at build time.
const sausExternals = [
  'bundle/config.ts',
  'bundle/debugBase.ts',
  'bundle/functions.ts',
  'bundle/inlinedAssets.ts',
  'bundle/inlinedModules.ts',
  'bundle/moduleMap.ts',
  'bundle/routes.ts',
  'client/routes.ts',
  'client/baseUrl.ts',
]

// These imports are handled by Rollup.
const bareExternals = [...builtinModules, 'debug', 'misty']

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
    client: path.join(clientDir, 'index.ssr.ts'),
    // used by @saus/html
    html: path.join(bundleDir, 'html.ts'),
    // "saus/http" entry point
    http: path.join(httpDir, 'index.ts'),
  })

  let bundleInfo: RuntimeBundleInfo

  const entryPaths = Object.values(entryMap)
  const entryBundles = Object.keys(entryMap).map(key => {
    const code = cache.get(key + '.js')
    if (code == null) {
      return null!
    }
    const map = JSON.parse(cache.get(key + '.js.map')!)
    return { code, map }
  })

  if (entryBundles.every(Boolean)) {
    bundleInfo = JSON.parse(cache.get('_bundle.json')!)
  } else {
    const config = await context.resolveConfig('build', { plugins })
    const { pluginContainer } = await vite.createTransformContext(config, false)

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
      const cacheKey = path.relative(cache.path, file.path)
      cache.set(cacheKey, file.text)
      cache.set(cacheKey + '.map', JSON.stringify(map))

      const entryPath = entryMap[removeExt(cacheKey)]
      if (entryPath) {
        const entryIndex = entryPaths.indexOf(entryPath)
        entryBundles[entryIndex] = { code: file.text, map }
      }
    }
  }

  const cacheDir = cache.path + '/'
  const chunkPaths = listFiles(cacheDir, true)

  return {
    name: 'saus:runtimeBundle',
    enforce: 'pre',
    async redirectModule(id, importer) {
      if (!importer) return
      if (id.startsWith(cacheDir)) return
      if (entryPaths.includes(id)) return
      if (bundleInfo.files.includes(importer)) return
      if (bundleInfo.files.includes(id)) {
        this.warn(
          `"${relativeToCwd(id)}" is bundled ahead-of-time, ` +
            `so it shouldn't be imported by "${relativeToCwd(importer)}"`
        )
      }
      return null
    },
    async resolveId(id, importer) {
      if (importer && entryPaths.includes(importer) && id[0] == '.') {
        return path.resolve(cacheDir, id)
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
    generateBundle(_, chunks) {
      for (const chunk of Object.values(chunks)) {
        if (chunk.type == 'asset') continue
        if (chunk.map) {
          chunk.map = remapping(chunk.map as any, file => {
            if (chunkPaths.includes(file)) {
              const cacheKey = path.relative(cacheDir, file)
              const map = cache.get(cacheKey + '.map')
              return map ? JSON.parse(map) : null
            }
            if (!file.includes('/node_modules/')) {
              const info = this.getModuleInfo(file)
              if (info?.code) {
                return loadSourceMap(info.code, file)
              }
            }
            return null
          }) as any
        }
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

function listFiles(dir: string, absolute?: boolean) {
  try {
    var files = fs.readdirSync(dir)
  } catch {
    return []
  }
  return absolute ? files.map(name => path.join(dir, name)) : files
}
