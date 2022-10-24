import { RouteLayout } from './layouts'
import { RenderRequest } from './renderer'
import { RETURN } from './tokens'

export async function renderHtml(
  layout: RouteLayout<any, any, any, string>,
  request: RenderRequest,
  serverProps?: Record<string, any>
): Promise<string> {
  let html = await layout.render(request)
  if (!/^\s*<body( |>)/.test(html)) {
    html = `<body>${RETURN}<div id="root">${html}</div>${RETURN}</body>`
  }
  if (layout.head) {
    const headRequest = serverProps
      ? { ...request, props: { ...request.props, ...serverProps } }
      : request

    let head = await layout.head(headRequest)
    if (!/^\s*<head( |>)/.test(head)) {
      head = `<head>${RETURN}${head}${RETURN}</head>`
    }
    html = head + html
  }
  if (!/^\s*<html( |>)/.test(html)) {
    html = `<html>${html}</html>`
  }
  return `<!DOCTYPE html>${RETURN}${html}`
}
