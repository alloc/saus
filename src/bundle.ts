import * as babel from '@babel/core'
import fs from 'fs'
import path from 'path'
import builtins from 'builtin-modules'
import { getBabelConfig, t } from './babel'
import {
  ClientFunction,
  createLoader,
  endent,
  extractClientFunctions,
  loadContext,
} from './core'
import { vite } from './core/vite'
import { renderPlugin } from './plugins/render'
import { routesPlugin } from './plugins/routes'
import { Profiling } from './profiling'

export async function bundle() {
  const context = await loadContext('build', undefined, [
    renderPlugin,
    routesPlugin,
  ])

  Profiling.mark('init ssr runtime')

  const loader = await createLoader(context, {
    server: { hmr: false, wss: false, watch: false },
  })

  let { config, routesPath, renderPath } = context

  const entryId = path.resolve('.saus/main.js')
  const entryModule = createVirtualModule({
    id: entryId,
    code: endent`
      import { main } from "/@fs/${path.resolve(
        __dirname,
        '../src/bundle/main.ts'
      )}"
      export default main(async () => {
        await import("/@fs/${routesPath}")
        await import("/@fs/${renderPath}")
      })
    `,
    moduleSideEffects: 'no-treeshake',
  })

  const redirectedModules = [
    redirectModule(
      'saus',
      path.resolve(__dirname, '../src/bundle/runtime/index.ts')
    ),
    redirectModule(
      'saus/core',
      path.resolve(__dirname, '../src/bundle/runtime/core.ts')
    ),
    redirectModule(
      'debug',
      path.resolve(__dirname, '../src/bundle/runtime/debug.ts')
    ),
  ]

  Profiling.mark('parse render functions')

  const functions = extractClientFunctions(renderPath)

  Profiling.mark('transform render functions')

  const transformFunction = async (fn: ClientFunction) => {
    const transformResult = await loader.pluginContainer.transform(
      [...fn.referenced, `export default ` + fn.function].join('\n'),
      renderPath
    )
    if (transformResult?.code) {
      const [prelude, transformedFn] =
        transformResult.code.split('\nexport default ')

      const { program } = (await babel.parseAsync(
        prelude,
        getBabelConfig(renderPath)
      )) as t.File

      fn.function = transformedFn.replace(/;\n?$/, '')
      fn.referenced = program.body.map(node =>
        prelude.slice(node.start!, node.end!)
      )
    }
  }

  // Ensure our calls to `pluginContainer.transform` don't throw when
  // plugin-react expects `renderPath` to exist in the module graph.
  await loader.moduleGraph.ensureEntryFromUrl('/@fs/' + renderPath)

  await Promise.all([
    ...functions.beforeRender.map(transformFunction),
    ...functions.render.map(renderFn =>
      Promise.all([
        transformFunction(renderFn),
        renderFn.didRender && transformFunction(renderFn.didRender),
      ])
    ),
  ])

  const functionsModule = createVirtualModule({
    id: path.resolve(__dirname, '../src/bundle/runtime/functions.ts'),
    code: `export default ` + JSON.stringify(functions, null, 2),
  })

  Profiling.mark('generate ssr bundle')

  const debugResolveId: vite.Plugin = {
    name: '',
    enforce: 'pre',
    async resolveId(id, importer) {
      const resolved = await this.resolve(id, importer, { skipSelf: true })
      if (resolved?.id.includes('saus/core')) {
        debugger
      }
      return resolved
    },
  }

  config = vite.mergeConfig(config, <vite.UserConfig>{
    plugins: [
      debugResolveId,
      entryModule,
      functionsModule,
      ...redirectedModules,
    ],
    ssr: {
      external: builtins,
      noExternal: /.+/,
    },
    build: {
      ssr: true,
      write: false,
      rollupOptions: {
        input: entryId,
      },
    },
  })

  const buildResult = (await vite.build(config)) as vite.ViteBuild

  Profiling.mark('write ssr bundle')

  const bundle = buildResult.output[0].output[0]
  const bundleMetadata = JSON.stringify(
    bundle,
    (key, value) =>
      key === 'code'
        ? undefined
        : key === 'modules'
        ? Object.keys(value).filter(key => !key.startsWith('\u0000'))
        : value,
    2
  )

  fs.writeFileSync(path.resolve('bundle.js'), bundle.code)
  fs.writeFileSync(path.resolve('build.json'), bundleMetadata)
}

function createVirtualModule(module: {
  id: string
  code: string
  moduleSideEffects?: boolean | 'no-treeshake'
}): vite.Plugin {
  return {
    name: 'virtual-module:' + module.id,
    resolveId: id => (id === module.id ? id : null),
    load: id => (id === module.id ? module : null),
  }
}

function redirectModule(targetId: string, replacementId: string): vite.Plugin {
  return {
    name: 'redirect-module:' + targetId,
    enforce: 'pre',
    async resolveId(id) {
      if (id === targetId) {
        return replacementId
      }
    },
  }
}
