import { createApp } from '../app/createApp'
import config from './config'
import { context } from './context'
import { defineClientEntry } from './defineClientEntry'
import { getEndpointGenerator } from './generateEndpoint'
import { createPageFactory } from './pageFactory'
import { ssrImport } from './ssrModules'
import { BundledApp } from './types'

// Allow `ssrImport("saus/client")` outside page rendering.
defineClientEntry()

// Load the routes before creating the Saus application.
export const init = ssrImport(config.ssrRoutesId).then((): BundledApp => {
  return createApp(context, getEndpointGenerator(context), [
    createPageFactory,
  ]) as any
})
