import AnsiConverter from 'ansi-to-html'

const ansiTheme = {
  0: '#000000',
  1: '#C75646',
  2: '#8EB33B',
  3: '#D0B03C',
  4: '#4E90A7',
  5: '#C8A0D1',
  6: '#218693',
  7: '#B0B0B0',
  10: '#5D5D5D',
  11: '#E09690',
  12: '#CDEE69',
  13: '#FFE377',
  14: '#9CD9F0',
  15: '#FBB1F9',
  16: '#77DFD8',
  17: '#F7F7F7',
}

export function ansiToHtml(input: string) {
  const convert = new AnsiConverter({
    newline: true,
    colors: ansiTheme,
  })
  return convert
    .toHtml(input)
    .replace(/\bhttps:\/\/[^\s]+/, match => `<a href="${match}">${match}</a>`)
}
