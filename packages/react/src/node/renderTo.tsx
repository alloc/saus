import React from 'react'
import ReactDOM from 'react-dom/server'
import { DocumentHook, render, RenderRequest, RouteModule } from 'saus/core'
import client from './client'

type Promisable<T> = T | PromiseLike<T>

type RenderFn = (
  module: RouteModule,
  request: RenderRequest
) => Promisable<JSX.Element | null | void>

/**
 * **For library use only.**
 *
 * This function is used by renderer packages that want to
 * convert JSX elements into HTML and process it.
 */
export const renderTo = (
  defineRenderer: typeof render,
  onDocument?: DocumentHook
) =>
  function render(route: string, render: RenderFn, start?: number) {
    return defineRenderer<JSX.Element>(
      route,
      async (mod, req) => {
        const content = await render(mod, req)
        return content == null ? null : <div id="saus_react">{content}</div>
      },
      { head: ReactDOM.renderToStaticMarkup, body: ReactDOM.renderToString },
      onDocument,
      client,
      start
    )
  }
