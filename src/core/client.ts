import fs from 'fs'
import MagicString from 'magic-string'
import {
  flattenCallChain,
  getBabelProgram,
  isChainedCall,
  NodePath,
  removeSSR,
  resolveReferences,
  t,
} from '../babel'
import { renderIdentRE } from '../plugins/render'
import type { RouteParams } from './routes'

/** A generated client module */
export interface Client {
  id: string
  code: string
  map?: ExistingRawSourceMap | null
}

interface ExistingRawSourceMap {
  file?: string
  mappings: string
  names: string[]
  sourceRoot?: string
  sources: string[]
  sourcesContent?: string[]
  version: number
}

/** JSON state provided by the renderer and made available to the client */
export type ClientState = Record<string, any> & {
  rootId?: string
  routePath: string
  routeParams: RouteParams
  error?: any
}
/**
 * Client fragments represent a portion of a render module,
 * which are pieced together by the SSR bundle based on
 * which page URL is being rendered.
 */
export interface ClientFunction {
  /** Route path for page matching */
  route?: string
  /** Character offset where the function is found within the source file */
  start: number
  /** The function implementation */
  function: string
  /** Referenced variables outside the function */
  referenced: string[]
}

export interface RenderFunction extends ClientFunction {
  didRender?: ClientFunction
}

export type ClientFunctions = {
  filename: string
  beforeRender: ClientFunction[]
  render: RenderFunction[]
}

export function mapClientFunctions<T>(
  functions: ClientFunctions,
  map: (fn: ClientFunction) => T
): T[] {
  const mapped: T[] = functions.beforeRender.map(map)
  functions.render.forEach(renderFn => {
    mapped.push(map(renderFn))
    if (renderFn.didRender) {
      mapped.push(map(renderFn.didRender))
    }
  })
  return mapped
}

export function extractClientFunctions(filename: string): ClientFunctions {
  const rawSource = fs.readFileSync(filename, 'utf8')
  const source = new MagicString(rawSource, {
    filename,
    indentExclusionRanges: [],
  })

  const beforeRenderFns: NodePath<t.ArrowFunctionExpression>[] = []
  const renderFns: NodePath<t.ArrowFunctionExpression>[] = []
  const didRenderFns: Record<number, NodePath<t.ArrowFunctionExpression>> = {}

  const program = getBabelProgram(rawSource, filename)
  program.traverse({
    CallExpression(callPath) {
      const callee = callPath.get('callee')
      if (callee.isIdentifier() && renderIdentRE.test(callee.node.name)) {
        const start = callPath.node.start!
        callPath.traverse({
          Identifier(path) {
            const { node, parentPath } = path

            // Parse the `render(...)` call
            if (node.start === start && parentPath.isCallExpression()) {
              parentPath.get('arguments').find(arg => {
                if (arg.isArrowFunctionExpression()) {
                  renderFns.push(arg)
                  return true
                }
              })
              path.stop()
            }

            // Parse the `.then(...)` call
            else if (isChainedCall(parentPath)) {
              const callChain = flattenCallChain(parentPath)
              if (callChain[0].node.start === start) {
                const thenCall =
                  parentPath.parentPath as NodePath<t.CallExpression>

                const thenProperty = thenCall
                  .get('callee')
                  .get('property') as NodePath

                if (!thenProperty.isIdentifier({ name: 'then' })) {
                  return
                }

                thenCall.get('arguments').find(arg => {
                  if (arg.isArrowFunctionExpression()) {
                    didRenderFns[start] = arg
                    return true
                  }
                })
              }
            }
          },
        })
      } else if (callee.isIdentifier({ name: 'beforeRender' })) {
        for (const arg of callPath.get('arguments')) {
          if (arg.isArrowFunctionExpression()) {
            beforeRenderFns.push(arg)
            break
          }
        }
      }
    },
  })

  const getSource = (path: NodePath) => {
    const { start, end } = path.node
    if (start == null || end == null) {
      throw Error('Missing node start/end')
    }
    return source.slice(start, end)
  }

  const defineClientFunction = (
    fn: NodePath<t.ArrowFunctionExpression>
  ): ClientFunction => {
    const parentArgs = fn.parentPath.get('arguments') as NodePath[]
    const routeArg =
      parentArgs[0] !== fn
        ? (parentArgs[0] as NodePath<t.StringLiteral>)
        : undefined

    const referenced = resolveReferences(
      fn.get('body'),
      path => !path.isDescendant(fn.parentPath)
    ).map(getSource)

    return {
      route: routeArg?.node.value,
      start: fn.parentPath.node.start!,
      function: getSource(fn),
      referenced,
    }
  }

  return {
    filename,
    beforeRender: beforeRenderFns.map(defineClientFunction),
    render: renderFns.map(path => {
      const fn = defineClientFunction(path) as RenderFunction
      const didRenderFn = didRenderFns[fn.start]
      if (didRenderFn) {
        didRenderFn.get('body').traverse(removeSSR(source))
        fn.didRender = defineClientFunction(didRenderFn)
      }
      return fn
    }),
  }
}

export type ClientImports = {
  [source: string]: string | (string | [name: string, alias: string])[]
}

export function defineClient(description: ClientDescription) {
  return description
}

export interface ClientDescription {
  /**
   * Define `import` statements to be included.
   *
   * The keys are modules to import from, and the values are either the
   * identifier used for the default export or an array of identifiers
   * used for named exports.
   */
  imports: ClientImports
  /**
   * Hydration code to run on the client.
   *
   * Executed inside a function with this type signature:
   *
   *     async (content: unknown, request: RenderRequest) => void
   *
   * Custom imports are available as well.
   */
  onHydrate: string
}
