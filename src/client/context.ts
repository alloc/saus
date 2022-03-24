export interface ClientContext {
  /**
   * The `saus.defaultPath` option set in Vite config.
   * @default "/404"
   */
  defaultPath: string
  /**
   * Equals `true` after the page is fully hydrated.
   */
  hydrated: boolean
}

type Constants = 'defaultPath'

let hydrated = false

const context: Omit<ClientContext, Constants> = {
  get hydrated() {
    return hydrated
  },
  set hydrated(newValue) {
    hydrated = newValue
    if (newValue) {
      window.dispatchEvent(new Event('hydrate'))
    }
  },
}

// @ts-ignore
globalThis.saus = context
