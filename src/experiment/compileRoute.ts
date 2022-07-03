import type { SausContext } from '@/context'
import type { Route } from '@/routes'
import assert from 'assert'
import esbuild from 'esbuild'
import path from 'path'

export async function compileRoute(route: Route, context: SausContext) {
  let layoutEntry = route.layout || context.defaultLayout?.file
  if (typeof layoutEntry == 'function') {
    layoutEntry = path.resolve(
      path.dirname(context.routesPath),
      importRE.exec(layoutEntry.toString())![1]
    )
  }

  assert(route.moduleId)
  assert(layoutEntry)

  const { config } = context
  const outDir = path.resolve(config.root, config.build.outDir)

  const { metafile } = await esbuild.build({
    absWorkingDir: context.root,
    // bundle: true,
    chunkNames: '_chunk.[hash]',
    entryNames: '[dir]/[name]',
    entryPoints: [route.moduleId, layoutEntry],
    format: 'esm',
    logLevel: 'error',
    metafile: true,
    outbase: config.root,
    outdir: outDir,
    // plugins: [await esbuildViteBridge(context)],
    sourcemap: 'external',
    splitting: true,
    target: 'esnext',
    treeShaking: true,
    write: false,
  })
}
