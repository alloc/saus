import fs from 'fs'
import MagicString from 'magic-string'
import path from 'path'
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
import type { ImportDescriptorMap } from '../utils/imports'
import type { RouteParams } from './routes'

export const stateCacheUrl =
  '/@fs' + path.resolve(__dirname, '../src/client/cache.ts')

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
  /** Character offset where the function is found within the source file */
  start: number
  /** Route path for page matching */
  route?: string
  /** Exists for `beforeRender` and `render` calls */
  callee?: NodePath<t.Identifier>
  /** The function implementation */
  function: string
  /** Referenced statements outside the function */
  referenced: WrappedNode<t.Statement>[]
  /**
   * When bundling for SSR, the function and its referenced statements need
   * to be compiled at build time.
   */
  transformResult?: {
    function: string
    referenced: string[]
  }
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

export function extractClientFunctions(
  filename: string,
  code = fs.readFileSync(filename, 'utf8'),
  ssr?: boolean
): ClientFunctions {
  const editor = !ssr && new MagicString(code)

  const beforeRenderFns: NodePath<t.ArrowFunctionExpression>[] = []
  const renderFns: NodePath<t.ArrowFunctionExpression>[] = []
  const didRenderFns: Record<number, NodePath<t.ArrowFunctionExpression>> = {}

  const program = getBabelProgram(code, filename)
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
    )

    const callee = fn.parentPath.get('callee') as NodePath
    return {
      route: routeArg?.node.value,
      callee: callee.isIdentifier() ? callee : undefined,
      start: fn.parentPath.node.start!,
      function: toWrappedNode(fn, editor || code).toString(),
      referenced: referenced.map(path => {
        return toWrappedNode(path, editor || code)
      }),
    }
  }

  return {
    filename,
    beforeRender: beforeRenderFns.map(defineClientFunction),
    render: renderFns.map(path => {
      const fn = defineClientFunction(path) as RenderFunction
      const didRenderFn = didRenderFns[fn.start]
      if (didRenderFn) {
        if (editor) {
          didRenderFn.get('body').traverse(removeSSR(editor))
        }
        fn.didRender = defineClientFunction(didRenderFn)
      }
      return fn
    }),
  }
}

export interface WrappedNode<T extends t.Node> {
  node: T & { start: number; end: number }
  toString(): string
}

function toWrappedNode<T extends t.Node>(
  path: NodePath<T>,
  source: string | MagicString
): WrappedNode<T> {
  const node = path.node as any
  return {
    node,
    toString: () => source.slice(node.start, node.end),
  }
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
  imports: ImportDescriptorMap
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
