import type { IncomingMessage, ServerResponse } from 'http'

type Env = {
  [key: string]: string
}

type PreviewData = string | false | object | undefined

/**
 * Next `API` route request
 */
export interface NextApiRequest extends IncomingMessage {
  /**
   * Object of `query` values from url
   */
  query: {
    [key: string]: string | string[]
  }
  /**
   * Object of `cookies` from header
   */
  cookies: {
    [key: string]: string
  }
  body: any
  env: Env
  preview?: boolean
  /**
   * Preview data set on the request, if any
   * */
  previewData?: PreviewData
}

/**
 * Send body of response
 */
type Send<T> = (body: T) => void

/**
 * Next `API` route response
 */
export type NextApiResponse<T = any> = ServerResponse & {
  /**
   * Send data `any` data in response
   */
  send: Send<T>
  /**
   * Send data `json` data in response
   */
  json: Send<T>
  status: (statusCode: number) => NextApiResponse<T>
  redirect(url: string): NextApiResponse<T>
  redirect(status: number, url: string): NextApiResponse<T>
  /**
   * Set preview data for Next.js' prerender mode
   */
  setPreviewData: (
    data: object | string,
    options?: {
      /**
       * Specifies the number (in seconds) for the preview session to last for.
       * The given number will be converted to an integer by rounding down.
       * By default, no maximum age is set and the preview session finishes
       * when the client shuts down (browser is closed).
       */
      maxAge?: number
    }
  ) => NextApiResponse<T>
  clearPreviewData: () => NextApiResponse<T>
  unstable_revalidate: (
    urlPath: string,
    opts?: {
      unstable_onlyGenerated?: boolean
    }
  ) => Promise<void>
}

/**
 * Next `API` route handler
 */
export type NextApiHandler<T = any> = (
  req: NextApiRequest,
  res: NextApiResponse<T>
) => unknown | Promise<unknown>
