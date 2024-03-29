import { serializeImports } from '@runtime/imports'
import { callPlugins } from '@utils/callPlugins'
import { generateId } from '@utils/generateId'
import { klona } from '@utils/klona'
import { SausContext } from './context'
import {
  createModuleProvider,
  ModuleProvider,
  VirtualModule,
} from './plugins/moduleProvider'
import { renderVirtualRoutes, VirtualRoute } from './virtualRoutes'

export interface VirtualImports {
  prepend: string[]
  append: string[]
}

export interface ModuleInjection {
  command: 'build' | 'serve'
  mode: string
  ssr: boolean
  /**
   * Add an import *before* all top-level user code.
   *
   * Useful if your module is file-backed.
   */
  prependImport(source: string): void
  /**
   * Add an import *after* all top-level user code.
   *
   * Useful if your module is file-backed.
   */
  appendImport(source: string): void
  /**
   * Add a module but don't import it automatically.
   *
   * Useful for dependency overrides and generated route modules.
   */
  addModule(module: VirtualModule): VirtualModule
  /**
   * Run a module *after* user code in the routes module.
   */
  appendModule(module: VirtualModule): VirtualModule
  /**
   * Run a module *before* user code in the routes module.
   */
  prependModule(module: VirtualModule): VirtualModule
  /**
   * Add routes after the user's routes are set up,
   * so the routes you define here take precedence.
   *
   * SSR only.
   */
  appendRoutes(routes: VirtualRoute[]): void
  /**
   * Add routes before the user's routes are set up,
   * so the user's routes take precedence.
   *
   * SSR only.
   */
  prependRoutes(routes: VirtualRoute[]): void
}

export function injectServerModules(
  { config, plugins }: SausContext,
  modules: ModuleProvider,
  injectedImports: VirtualImports
): Promise<void> {
  const prependImport = (source: string) => {
    injectedImports.prepend.push(source)
  }
  const appendImport = (source: string) => {
    injectedImports.append.push(source)
  }
  const addRoutes = (routes: VirtualRoute[]) => {
    return modules.addServerModule({
      id: `\0virtual-routes-${generateId()}.js`,
      code: renderVirtualRoutes(routes),
    })
  }
  return callPlugins(plugins, 'injectModules', {
    command: config.command,
    mode: config.mode,
    ssr: true,
    prependImport,
    appendImport,
    prependModule(module) {
      prependImport(module.id)
      return modules.addServerModule(module)
    },
    appendModule(module) {
      appendImport(module.id)
      return modules.addServerModule(module)
    },
    addModule(module) {
      return modules.addServerModule(module)
    },
    prependRoutes(routes) {
      prependImport(addRoutes(routes).id)
    },
    appendRoutes(routes) {
      appendImport(addRoutes(routes).id)
    },
  })
}

export function injectClientModules(
  context: SausContext,
  modules: ModuleProvider,
  injectedImports: VirtualImports
): Promise<void> {
  const { config, plugins } = context
  return callPlugins(plugins, 'injectModules', {
    command: config.command,
    mode: config.mode,
    ssr: false,
    prependImport(source) {
      injectedImports.prepend.push(source)
    },
    appendImport(source) {
      injectedImports.append.push(source)
    },
    prependModule(module) {
      modules.addClientModule(module)
      injectedImports.prepend.push(module.id)
      return module
    },
    appendModule(module) {
      modules.addClientModule(module)
      injectedImports.append.push(module.id)
      return module
    },
    addModule(module) {
      modules.addClientModule(module)
      return module
    },
    prependRoutes(routes) {
      throw Error('prependRoutes is not supported in client context')
    },
    appendRoutes(routes) {
      throw Error('appendRoutes is not supported in client context')
    },
  })
}

export async function getServerInjection(context: SausContext) {
  const imports = klona(context.injectedImports)
  const provider = createModuleProvider({
    serverModules: new Map(context.injectedModules.serverModules),
    watcher: context.watcher,
  })
  provider.name = 'saus:serverInjection'
  await injectServerModules(context, provider, imports)
  return {
    add: provider.addServerModule,
    provider,
    transform(code: string) {
      if (imports.prepend.length) {
        code = serializeImports(imports.prepend).join('; ') + '; ' + code
      }
      if (imports.append.length) {
        code += serializeImports(imports.append).join('\n') + '\n'
      }
      return code
    },
  }
}

export async function getClientInjection(context: SausContext) {
  const imports: VirtualImports = { prepend: [], append: [] }
  const provider = createModuleProvider({
    clientModules: new Map(context.injectedModules.clientModules),
    watcher: context.watcher,
  })
  provider.name = 'saus:clientInjection'
  await injectClientModules(context, provider, imports)
  return {
    add: provider.addClientModule,
    provider,
    /** Append and prepend any virtual imports */
    transform(code: string) {
      if (imports.prepend.length) {
        code = serializeImports(imports.prepend).join('; ') + '; ' + code
      }
      if (imports.append.length) {
        code +=
          `\n` +
          imports.append.map(source => `await import("${source}")`).join(`\n`)
      }
      return code
    },
  }
}
