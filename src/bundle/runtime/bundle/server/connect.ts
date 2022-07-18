import { Promisable } from '@/utils/types'
import EventEmitter from 'events'
import http from 'http'

/**
 * A tiny implementation of the `connect` package.
 */
export function connect<RequestProps extends object = {}>(
  extendRequest?: (req: http.IncomingMessage) => Promisable<RequestProps>
): connect.App<RequestProps> {
  const stack: connect.Middleware[] = []
  const events = new EventEmitter()

  async function app(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    next?: connect.NextFunction
  ) {
    next ||= () => onError(404)

    let resolve: () => void
    try {
      if (extendRequest) {
        Object.assign(req, await extendRequest(req))
      }
      for (const handler of stack) {
        const promise = new Promise<void>(r => (resolve = r))
        const result = handler(req as any, res, resolve!)
        if (result instanceof Promise) {
          result.catch(onError)
        }
        await promise
      }
    } catch (e) {
      return onError(e)
    }

    function onError(e: any) {
      events.emit('error', e, req, res, next)
    }

    next()
  }

  app.use = (handler: connect.Middleware) => (stack.push(handler), app)
  app.on = (name: string, listener: any) => (events.on(name, listener), app)

  return app as any
}

export namespace connect {
  export type Request<Props extends object = {}> = Props &
    http.IncomingMessage & { url: string }
  export type Response = http.ServerResponse
  export type NextFunction = (error?: any) => void

  export type ErrorListener<RequestProps extends object = {}> = (
    e: any,
    req: Request<RequestProps>,
    res: Response,
    next: NextFunction
  ) => void

  export type Middleware<RequestProps extends object = {}> = (
    req: Request<RequestProps>,
    res: Response,
    next: NextFunction
  ) => void | Promise<void>

  export interface App<RequestProps extends object = {}> {
    (
      req: http.IncomingMessage,
      res: http.ServerResponse,
      next?: connect.NextFunction
    ): Promise<void>

    use(handler: connect.Middleware<RequestProps>): this
    on(name: 'error', listener: connect.ErrorListener<RequestProps>): this
  }
}
