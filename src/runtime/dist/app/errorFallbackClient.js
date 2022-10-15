import { createHotContext } from '/@id/@vite/client'

createHotContext().on('vite:beforeFullReload', () => {
  document.body.innerHTML = ''
})

document.addEventListener('click', event => {
  const { target } = event
  if (target.tagName == 'A' && target.className == 'file-link') {
    event.preventDefault()
    fetch(target.href)
  }
})

