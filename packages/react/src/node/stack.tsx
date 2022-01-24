import React from 'react'
import ReactDOM from 'react-dom/server'

const { ReactDebugCurrentFrame } = (React as any)
  .__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED

// Avoid crashing in case two instances of React are present.
if (ReactDebugCurrentFrame) {
  const ReactDOMServerRendererPrototype: any = Object.getPrototypeOf(
    (ReactDOM.renderToNodeStream(<div />) as any).partialRenderer
  )

  const stackFrameRE = /^ {4}at (?:.+?\s+\()?.+?:\d+(?::\d+)?\)?/m

  // Ensure the component stack is included in stack traces.
  const { render } = ReactDOMServerRendererPrototype
  ReactDOMServerRendererPrototype.render = function (...args: any[]) {
    try {
      return render.apply(this, args)
    } catch (err: any) {
      const componentStack = ReactDebugCurrentFrame.getStackAddendum()
      const firstFrame = stackFrameRE.exec(err.stack)
      if (firstFrame) {
        const index = firstFrame.index + firstFrame[0].length
        err.stack =
          err.stack.slice(0, index) + componentStack + err.stack.slice(index)
      } else {
        err.message += componentStack
      }
      throw err
    }
  }
}
