/// <reference types="vite/client" />

declare const saus: {
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
