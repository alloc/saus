import fs from 'fs'
import path from 'path'
import elaps from 'elaps'
import {
  createLoader,
  endent,
  extractClientFunctions,
  loadContext,
} from './core'
import { setRenderModule, setRoutesModule } from './core/global'
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

  Profiling.mark('load ssr modules')

  setRenderModule(context)
  setRoutesModule(context)
  try {
    await loader.ssrLoadModule(
      [routesPath, renderPath].map(file => file.replace(context.root, ''))
    )
  } finally {
    setRenderModule(null)
    setRoutesModule(null)
  }

  Profiling.mark('parse render functions')

  const functions = extractClientFunctions(
    renderPath,
    context.renderers,
    context.defaultRenderer
  )

  /* TODO: embed render functions */

  Profiling.mark('generate ssr bundle')

  const entryId = path.resolve('.saus/main.js')
  const entryModule = createVirtualModule({
    id: entryId,
    code: endent`
      import { main } from "saus/src/bundle/main"
      export default main(async () => {
        await import("/@fs/${routesPath}")
        await import("/@fs/${renderPath}")
      })
    `,
    moduleSideEffects: 'no-treeshake',
  })

  config = vite.mergeConfig(config, <vite.UserConfig>{
    plugins: [
      entryModule,
      redirectModule('saus', importer =>
        path.resolve(__dirname, '../src/bundle/runtime/index.ts')
      ),
      redirectModule('saus/core', importer =>
        path.resolve(__dirname, '../src/bundle/runtime/core.ts')
      ),
    ],
    build: {
      ssr: true,
      write: false,
      rollupOptions: {
        input: entryId,
        // output: { inlineDynamicImports: true },
      },
    },
  })

  const buildResult = (await vite.build(config)) as vite.ViteBuild

  Profiling.mark('write ssr bundle')

  fs.writeFileSync(
    path.resolve('bundle.js'),
    // @ts-ignore
    buildResult.output[0].output[0].code
  )
  fs.writeFileSync(
    path.resolve('build.json'),
    JSON.stringify(buildResult.output, null, 2)
  )
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

function redirectModule(
  redirectedId: string,
  resolveId: (importer: string | undefined) => string | null
): vite.Plugin {
  return {
    name: 'redirect-module:' + module.id,
    enforce: 'pre',
    resolveId(id, importer) {
      if (id === redirectedId) {
        const resolved = resolveId(importer)
        if (resolved) {
          return this.resolve(resolved, importer, { skipSelf: true })
        }
      }
    },
  }
}

// function preferExtensions(
//   test: (id: string, importer: string | undefined) => string[] | false | void
// ): vite.Plugin {
//   return {
//     name: 'prefer-extensions',
//     enforce: 'pre',
//     async resolveId(id, importer) {
//       const resolved = await this.resolve(id, importer, { skipSelf: true })
//       if (resolved) {
//         const extensions = test(resolved.id, importer)
//         if (!extensions) {
//           return
//         }
//         const resolvedExtension = path.extname(resolved.id)
//         const resolvedFileSansExtension = path.join(
//           path.dirname(resolved.id),
//           path.basename(resolved.id, resolvedExtension)
//         )
//         for (const extension of extensions) {
//           if (extension === resolvedExtension) {
//             break
//           }
//           id = resolvedFileSansExtension + extension
//           if (fs.existsSync(id)) {
//             return id
//           }
//         }
//         return resolved
//       }
//     },
//   }
// }
