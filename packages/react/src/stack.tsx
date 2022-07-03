import React from 'react'
import ReactDOM from 'react-dom/server'

const { ReactDebugCurrentFrame } = (React as any)
  .__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED

// Avoid crashing in case two instances of React are present.
if (ReactDebugCurrentFrame) {
  const ReactDOMServerRendererPrototype: any = Object.getPrototypeOf(
    (ReactDOM.renderToNodeStream(<div />) as any).partialRenderer
  )

  // Ensure the component stack is included in stack traces.
  const { render } = ReactDOMServerRendererPrototype
  ReactDOMServerRendererPrototype.render = function (...args: any[]) {
    try {
      return render.apply(this, args)
    } catch (err: any) {
      const errorStack = err.stack
      const componentStack: string = ReactDebugCurrentFrame.getStackAddendum()
      const hoistedFrames: string[] = []
      const stackFrameRE = /\n {4}at (?:.+?\s+\()?.+?:\d+(?::\d+)?\)?/g
      while (stackFrameRE.lastIndex < errorStack.length) {
        const frame = stackFrameRE.exec(errorStack)
        if (frame && !frame[0].includes('/react-dom/')) {
          hoistedFrames.push(frame[0])
        } else break
      }
      if (hoistedFrames.length) {
        const componentFrames = componentStack.split('\n').map(f => '\n' + f)
        while (componentFrames.length) {
          if (hoistedFrames.includes(componentFrames[0])) {
            componentFrames.shift()
          } else break
        }
        err.stack =
          err.stack.slice(0, stackFrameRE.lastIndex) + componentFrames.join('')
      } else {
        err.message += componentStack
      }
      throw err
    }
  }
}
