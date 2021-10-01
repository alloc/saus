declare const document: { querySelector: (selector: string) => any }

export function getState() {
  const dataContainer = document.querySelector('#STITE_DATA')
  dataContainer.remove()
  return JSON.parse(dataContainer.textContent)
}
