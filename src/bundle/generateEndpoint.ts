import { AppContext } from '../app/types'
import { Endpoint } from '../core/endpoint'

export function getEndpointGenerator(context: AppContext): Endpoint.Generator {
  return (method, route, app) => req => {
    // TODO
  }
}
