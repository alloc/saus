export interface ClientConstants {
  /**
   * The `saus.defaultPath` option set in Vite config.
   * @default "/404"
   */
  defaultPath: string
  /**
   * The project root as defined in Vite config.
   *
   * ⚠︎ Exists in development only!
   */
  devRoot: string
  /**
   * The `saus.stateModuleBase` option set in Vite config.
   * @default "/.saus/state/"
   */
  stateModuleBase: string
}

export interface ClientContext extends ClientConstants {
  /**
   * Equals `true` after the page is fully hydrated.
   */
  hydrated: boolean
}

let hydrated = false

const context: Omit<ClientContext, keyof ClientConstants> = {
  get hydrated() {
    return hydrated
  },
  set hydrated(newValue) {
    hydrated = newValue
    if (newValue) {
      dispatchEvent(new Event('hydrate'))
    }
  },
}

// @ts-ignore
globalThis.saus = context
export default context as ClientContext
