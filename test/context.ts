import { moduleRedirection } from '@/plugins/moduleRedirection'
import { injectRoutesModule } from '@/virtualRoutes'
import { injectNodeModule } from '@/vm'
import endent from 'endent'
import { resolve } from 'path'
import { BuildContext, loadBundleContext } from '../src/bundle/context'
import { setConfigFile } from './config'

export async function loadTestContext(config: { root: string }) {
  const distDir = resolve(__dirname, '../dist')

  setConfigFile(config.root, {
    saus: {
      routes: './routes.ts',
    },
  })

  const ctx = await loadBundleContext<BuildContext>({
    write: false,
    config: {
      root: config.root,
      logLevel: 'silent',
      plugins: [
        moduleRedirection(),
        {
          name: 'global-imports',
          resolveBareImport(id, importer) {
            if (id === 'saus') {
              return {
                id: resolve(distDir, 'index.js'),
                external: true,
              }
            }
          },
        },
      ],
    },
  })

  // Prevent caching of compiled files.
  ctx.compileCache = null!

  // Define a virtual module for the routes path.
  injectRoutesModule(ctx, [
    {
      path: '/',
      entry: {
        id: resolve(ctx.root, 'src/pages/home.js'),
        code: 'export default () => "Home"',
      },
    },
    {
      path: '/about',
      entry: {
        id: resolve(ctx.root, 'src/pages/about.js'),
        code: 'export default () => "About"',
      },
    },
  ])

  // Define a virtual module for the default layout.
  ctx.injectedModules.addServerModule({
    id: resolve(ctx.root, 'src/layouts/default'),
    code: endent`
      export default {
        render: req => req.module.default(),
      }
    `,
  })

  // Vitest loads all modules virtually, so we need to manually add Saus
  // entry modules to Node's internal cache or Node-required modules won't
  // have access to the same global state (eg: the `routesModule` variable)
  // and `loadRoutes` will be ineffective.
  injectNodeModule(resolve(distDir, 'index.js'), await import('../src/index'))

  await ctx.loadRoutes()
  return ctx
}
