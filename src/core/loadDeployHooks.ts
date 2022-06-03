import fs from 'fs'
import path from 'path'
import { createAsyncRequire } from '../vm/asyncRequire'
import { compileNodeModule } from '../vm/compileNodeModule'
import { formatAsyncStack } from '../vm/formatAsyncStack'
import { ModuleMap } from '../vm/types'
import { BundleContext } from './bundle'
import { DeployHooks } from './deploy'
import { setDeployModule } from './global'

export async function loadDeployHooks(
  context: BundleContext
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
        null,
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
  return deployConfig.deployHooks
}
