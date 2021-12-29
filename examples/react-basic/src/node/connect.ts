import http from 'http'
import EventEmitter from 'events'

/**
 * A tiny implementation of the `connect` package.
 */
export function connect() {
  const stack: connect.Middleware[] = []
  const events = new EventEmitter()

  async function app(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    next: connect.NextFunction = () => {}
  ) {
    let resolve: () => void
    try {
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
  app.on = ((name, listener) => (events.on(name, listener), app)) as {
    (name: 'error', listener: connect.ErrorListener): connect.App
  }

  return app
}

export namespace connect {
  export type Request = http.IncomingMessage & { url: string }
  export type Response = http.ServerResponse
  export type NextFunction = () => void

  export type ErrorListener = (
    e: any,
    req: Request,
    res: Response,
    next: NextFunction
  ) => void

  export type Middleware = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => void | Promise<void>

  export type App = ReturnType<typeof connect>
}
