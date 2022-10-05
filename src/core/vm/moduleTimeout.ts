export const kModuleTimeout = Symbol.for('saus.moduleTimeout')
export const kModuleTimeoutSecs = Symbol.for('saus.moduleTimeoutSecs')
export const kModuleTimeoutCallback = Symbol.for('saus.moduleTimeoutCallback')
export const kModuleSetTimeout = '__setModuleTimeout'

export function setModuleTimeout(exports: any) {
  const callback = exports[kModuleTimeoutCallback]
  const delay = exports[kModuleTimeoutSecs] * 1e3
  if (callback && delay) {
    exports[kModuleTimeout] = setTimeout(callback, delay)
  }
}
