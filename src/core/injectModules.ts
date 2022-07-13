import { callPlugins } from '@/utils/callPlugins'
import { serializeImports } from '@/utils/imports'
import { SausContext } from './context'
import {
  createModuleProvider,
  ModuleProvider,
  VirtualModule,
} from './plugins/moduleProvider'

export interface InjectedImports {
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
}

export function injectServerModules(context: SausContext) {
  const { config, injectedImports, modules, plugins } = context
  return callPlugins(plugins, 'injectModules', {
    command: config.command,
    mode: config.mode,
    ssr: true,
    prependImport(source) {
      injectedImports.prepend.push(source)
    },
    appendImport(source) {
      injectedImports.append.push(source)
    },
    prependModule(module) {
      modules.addServerModule(module)
      injectedImports.prepend.push(module.id)
      return module
    },
    appendModule(module) {
      modules.addServerModule(module)
      injectedImports.append.push(module.id)
      return module
    },
    addModule(module) {
      modules.addServerModule(module)
      return module
    },
  })
}

export function injectClientModules(
  context: SausContext,
  modules: ModuleProvider,
  injectedImports: InjectedImports
) {
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
  })
}

export async function createClientInjection(context: SausContext) {
  const modules = createModuleProvider()
  const injectedImports: InjectedImports = {
    prepend: [],
    append: [],
  }

  await injectClientModules(context, modules, injectedImports)

  return {
    modules,
    injectImports(code: string) {
      if (injectedImports.prepend.length) {
        code =
          serializeImports(injectedImports.prepend).join('\n') + '\n' + code
      }
      if (injectedImports.append.length) {
        code +=
          `\n` +
          injectedImports.append.map(source => `import("${source}")`).join(`\n`)
      }
      return code
    },
  }
}
