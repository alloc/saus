import { ImportDescriptorMap } from './runtime/imports'

export function defineClient(description: ClientDescription) {
  return description
}

export interface ClientDescription {
  /**
   * Define `import` statements to be included.
   *
   * The keys are modules to import from, and the values are either the
   * identifier used for the default export or an array of identifiers
   * used for named exports.
   */
  imports: ImportDescriptorMap
  /**
   * Hydration code to run on the client.
   *
   * Executed inside a function with this type signature:
   *
   *     async (content: unknown, request: RenderRequest) => void
   *
   * Custom imports are available as well.
   */
  onHydrate: string
}
