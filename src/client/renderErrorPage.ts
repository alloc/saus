import { renderErrorFallback } from '../app/errorFallback'

export function renderErrorPage(e: any) {
  const errorElem = document.createElement('div')
  const style = [
    'visibility: hidden',
    'position: fixed',
    'top: 0',
    'left: 0',
    'width: 100vw',
    'height: 100vh',
    'z-index: 9999',
  ]
  errorElem.setAttribute('style', style.join(';'))
  const shadowRoot = errorElem.attachShadow({ mode: 'open' })
  shadowRoot.innerHTML = renderErrorFallback(e, {
    root: location.origin,
  })
  document.body.appendChild(errorElem)
  requestIdleCallback(() => {
    errorElem.style.visibility = ''
  })
}
