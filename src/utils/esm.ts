import { dataToEsm } from '@rollup/pluginutils'

const esmOptions = { indent: '  ', namedExports: false }

export function serializeToEsm(data: unknown, assignTo?: string) {
  let code = dataToEsm(data, esmOptions)
  if (assignTo) {
    code = code.replace(/^export default/, assignTo + ' =')
  }
  return code
}
