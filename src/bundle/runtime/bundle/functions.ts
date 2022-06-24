// Stub module replaced at build time

interface ClientFunction {
  start: number
  route?: string
  function: string
  referenced: string[]
}

interface RenderFunction extends ClientFunction {
  didRender?: ClientFunction
}

const functions = {} as {
  filename: string
  beforeRender: ClientFunction[]
  render: RenderFunction[]
}

export default functions
