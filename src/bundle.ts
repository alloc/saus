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

export async function bundle() {
  const context = await loadContext('build', undefined, [
    renderPlugin,
    routesPlugin,
  ])

  const loader = await createLoader(context, {
    server: { hmr: false, wss: false, watch: false },
  })

  let { config, routesPath, renderPath } = context

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

  const functions = extractClientFunctions(
    renderPath,
    context.renderers,
    context.defaultRenderer
  )
  debugger

  const entryId = 'main.js'
  const entryModule = createVirtualModule({
    id: entryId,
    code: endent`
      import { main } from "saus/src/bundle/main"
      export default main(async () => {
        await import("/@fs/${routesPath}")
        await import("/@fs/${renderPath}")
      })
    `,
  })

  config = vite.mergeConfig(config, <vite.UserConfig>{
    plugins: [entryModule],
    build: {
      write: false,
      rollupOptions: {
        input: entryId,
        output: { inlineDynamicImports: true },
      },
    },
  })

  const buildResult = (await vite.build(config)) as vite.ViteBuild
  debugger
}

function createVirtualModule(module: {
  id: string
  code: string
}): vite.Plugin {
  return {
    name: 'virtual-module:' + module.id,
    resolveId: id => (id === module.id ? id : null),
    load: id => (id === module.id ? module.code : null),
  }
}
