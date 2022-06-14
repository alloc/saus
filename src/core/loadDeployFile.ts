import fs from 'fs'
import path from 'path'
import { createAsyncRequire } from '../vm/asyncRequire'
import { compileNodeModule } from '../vm/compileNodeModule'
import { formatAsyncStack } from '../vm/formatAsyncStack'
import { ModuleMap } from '../vm/types'
import { DeployContext, DeployHook, DeployHooks, DeployTarget } from './deploy'
import { setDeployModule } from './global'

export async function loadDeployFile(
  context: DeployContext
): Promise<DeployHooks> {
  let {
    filterStack,
    saus: { deploy: execPath },
  } = context.config

  if (!execPath) {
    return new Map()
  }

  execPath = path.resolve(context.root, execPath)

  const moduleMap: ModuleMap = {}
  const require = createAsyncRequire({
    moduleMap,
    filterStack,
    isCompiledModule: (id: string) =>
      !id.includes('/node_modules/') && id.startsWith(context.root + '/'),
    compileModule(id) {
      return compileNodeModule(
        fs.readFileSync(id, 'utf8'),
        id,
        require,
        context.compileCache,
        context.config.env
      )
    },
  })

  const deployConfig = setDeployModule({
    deployHooks: new Map(),
  })
  try {
    await require(execPath)
  } catch (error: any) {
    formatAsyncStack(error, moduleMap, [], filterStack)
    throw error
  } finally {
    setDeployModule(null)
  }

  const deployHooks = new Map<DeployHook, DeployTarget[]>()
  await Promise.all(
    Array.from(deployConfig.deployHooks, async ([hook, targets]) => {
      deployHooks.set(hook, await Promise.all(targets))
    })
  )
  return deployHooks
}
