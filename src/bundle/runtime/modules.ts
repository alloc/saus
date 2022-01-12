import { ClientModule } from '../types'

/**
 * For entry chunks, keys are import statements.
 * For vendor chunks, keys are generated file names.
 * For route chunks, keys are dev URLs.
 */
export interface ClientModuleMap {
  [key: string]: ClientModule
}

/* Stub module replaced at build time */
declare const moduleMap: ClientModuleMap
export default moduleMap
