import fs from 'fs'
import path from 'path'
import {
  flattenCallChain,
  isChainedCall,
  MagicString,
  NodePath,
  removeSSR,
  t,
  transformSync,
} from '../babel'
import type { SausContext } from './context'
import type { RouteParams } from './routes'
import type { Renderer } from './renderer'
import type { SourceDescription } from './vite'

/** A generated client module */
export type Client = { id: string } & SourceDescription

/** JSON state provided by the renderer and made available to the client */
export type ClientState = Record<string, any> & {
  rootId?: string
  routePath: string
  routeParams: RouteParams
  error?: any
}

export async function getClient(
  context: SausContext,
  { getClient, hash, start }: Renderer
): Promise<Client | undefined> {
  if (!getClient) return

  let program!: NodePath<t.Program>
  const visitor: babel.Visitor = {
    Program: path => {
      program = path
      path.stop()
    },
  }

  const filename = context.renderPath
  const source = fs.readFileSync(filename, 'utf8')

  // Use the AST for traversal, but not code generation.
  transformSync(source, filename, {
    plugins: [{ visitor }],
    sourceMaps: false,
    code: false,
  })

  const renderStmt = program
    .get('body')
    .find(path => path.node.start === start) as NodePath<t.ExpressionStatement>

  if (!renderStmt) {
    return // Something ain't right.
  }

  let renderFn!: NodePath<t.ArrowFunctionExpression>
  let didRenderFn: NodePath<t.ArrowFunctionExpression> | undefined

  renderStmt.traverse({
    Identifier(path) {
      const { node, parentPath } = path

      // Parse the `render(...)` call
      if (node.start === start && parentPath.isCallExpression()) {
        parentPath.get('arguments').find(arg => {
          if (arg.isArrowFunctionExpression()) {
            renderFn = arg
            return true
          }
        })
        path.stop()
      }

      // Parse the `.then(...)` call
      else if (isChainedCall(parentPath)) {
        const callChain = flattenCallChain(parentPath)
        if (callChain[0].node.start === start) {
          const thenCall = parentPath.parentPath as NodePath<t.CallExpression>
          thenCall.get('arguments').find(arg => {
            if (arg.isArrowFunctionExpression()) {
              didRenderFn = arg
              return true
            }
          })
        }
      }
    },
  })

  // Remove SSR-only logic so resolveReferences works right.
  didRenderFn?.get('body').traverse(removeSSR())

  const client = await getClient({
    source,
    program,
    renderFn,
    didRenderFn,
    extract(path) {
      const { start, end } = path.node
      if (start == null || end == null) {
        throw Error('Missing node start/end')
      }
      if (!program.isAncestor(path)) {
        throw Error('Given node is not from this file')
      }
      const str = new MagicString(source, { filename } as any)
      return str.remove(0, start).remove(end, source.length)
    },
  })

  if (client)
    return {
      id: `client-${hash}${path.extname(filename)}`,
      ...client,
    }
}

type Promisable<T> = T | PromiseLike<T>

/** Function that generates a client module */
export type ClientProvider = (
  context: ClientContext
) => Promisable<SourceDescription | void>

export type ClientContext = {
  source: string
  program: NodePath<t.Program>
  /**
   * The render function passed to `render`. This function is
   * expected to be isomorphic.
   */
  renderFn: NodePath<t.ArrowFunctionExpression>
  /**
   * The side effect passed to `.then`. This function should be
   * called after the page is hydrated.
   *
   * Any logic wrapped in an `import.meta.env.SSR` condition is
   * already tree-shaked.
   */
  didRenderFn?: NodePath<t.ArrowFunctionExpression>
  /**
   * Extract a node to be used in the generated client.
   *
   * Returns a `MagicString` that remembers where the node was
   * taken from, so sourcemaps are accurate. Add it to a `MagicBundle`
   * with its `addSource` method, then call `toString` and `generateMap`
   * on the bundle.
   */
  extract: (path: NodePath) => MagicString
}
