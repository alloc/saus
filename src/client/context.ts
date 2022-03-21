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

const context: Omit<ClientContext, Constants> = {
  hydrated: false,
}

// @ts-ignore
globalThis.saus = context
