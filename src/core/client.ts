import fs from 'fs'
import path from 'path'
import md5Hex from 'md5-hex'
import {
  flattenCallChain,
  isChainedCall,
  MagicBundle,
  MagicString,
  NodePath,
  remove,
  removeSSR,
  replaceWith,
  resolveReferences,
  t,
  transformSync,
} from '../babel'
import type { BeforeRenderHook } from './render'
import type { Renderer } from './renderer'
import type { RouteParams } from './routes'
import type { SourceDescription } from './vite'
import { debug } from './debug'
import endent from 'endent'

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
  filename: string,
  { getClient, start }: Renderer,
  usedHooks: BeforeRenderHook[]
): Promise<Client | undefined> {
  if (!getClient) return

  const sourceStr = fs.readFileSync(filename, 'utf8')
  const source = new MagicString(sourceStr, { filename } as any)

  let program!: NodePath<t.Program>
  const visitor: babel.Visitor = {
    Program: path => {
      program = path
      path.stop()
    },
  }

  // Use the AST for traversal, but not code generation.
  transformSync(sourceStr, filename, {
    plugins: [{ visitor }],
    sourceMaps: false,
    code: false,
  })

  const renderStmt = program
    .get('body')
    .find(path => path.node.start === start) as NodePath<t.ExpressionStatement>

  if (!renderStmt) {
    debug('Failed to generate client. Render statement was not found.')
    return
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

  const beforeRenderFns: NodePath<t.ArrowFunctionExpression>[] = []
  usedHooks.forEach(hook => {
    const hookStmt = program
      .get('body')
      .find(
        path => path.node.start === hook.start!
      ) as NodePath<t.ExpressionStatement>

    hookStmt.assertExpressionStatement()
    let hookExpr = hookStmt.get('expression') as NodePath<t.CallExpression>

    hookExpr.assertCallExpression()
    for (const arg of hookExpr.get('arguments')) {
      if (arg.isArrowFunctionExpression()) {
        beforeRenderFns.push(arg)
        break
      }
    }
  })

  // Remove SSR-only logic so resolveReferences works right.
  didRenderFn?.get('body').traverse(removeSSR(source))

  const context: ClientContext = {
    source: sourceStr,
    program,
    renderFn,
    didRenderFn,
    beforeRenderFns,
    extract(path) {
      const { start, end } = path.node
      if (start == null || end == null) {
        throw Error('Missing node start/end')
      }
      if (!program.isAncestor(path)) {
        throw Error('Given node is not from this file')
      }
      return source.clone().remove(0, start).remove(end, sourceStr.length)
    },
    replaceWith(path, replacement) {
      return replaceWith(path, replacement, source)
    },
    remove(path) {
      return remove(path, source)
    },
  }

  let client = await getClient(context)
  if (client) {
    if ('onHydrate' in client) {
      client = renderClientDescription(client, context)
    }
    const hash = md5Hex(client.code).slice(0, 16)
    return {
      id: `client.${hash}${path.extname(filename)}`,
      ...client,
    }
  }
}

function renderClientDescription(
  { imports, onHydrate }: ClientDescription,
  { extract, renderFn, didRenderFn, beforeRenderFns }: ClientContext
): SourceDescription {
  const script = new MagicBundle()

  // Top-level statements are extracted from the render module.
  const statements = new Set<NodePath>()
  const useStatement = (stmt: NodePath<t.Statement>) => {
    if (statements.has(stmt)) return
    script.addSource(extract(stmt))
    statements.add(stmt)
  }
  const useReferencedStatements = (fn: NodePath<t.ArrowFunctionExpression>) => {
    const refs = resolveReferences(
      fn.get('body'),
      path => !path.isDescendant(fn.parentPath)
    )
    refs.forEach(useStatement)
  }

  const beforeRenderCalls: string[] = []
  beforeRenderFns.forEach((hook, i) => {
    useReferencedStatements(hook)
    const hookId = `$beforeRender${i + 1}`
    beforeRenderCalls.push(`${hookId}(request)`)
    const hookStr = extract(hook)
    hookStr.prepend(`const ${hookId} = `)
    script.addSource(hookStr)
  })

  useReferencedStatements(renderFn)
  const renderStr = extract(renderFn)
  renderStr.prepend('const $render = ')
  script.addSource(renderStr)

  if (didRenderFn) {
    useReferencedStatements(didRenderFn)
    const didRenderStr = extract(didRenderFn)
    didRenderStr.prepend('const $didHydrate = ')
    script.addSource(didRenderStr)
  }

  const importsBlock = endent`
    import { onHydrate as $onHydrate } from "saus/client"
    ${renderImports(imports).join('\n')}
  `

  const hydrateBlock = endent`
    $onHydrate(async (routeModule, request) => {
      ${beforeRenderFns.length ? beforeRenderCalls.join('\n') : ''}
      const content = await $render(routeModule, request)
      ${onHydrate}
      ${didRenderFn ? '$didHydrate(request)' : ''}
    })
  `

  script.prepend(importsBlock + '\n')
  script.append('\n' + hydrateBlock)

  return {
    code: script.toString(),
    map: script.generateMap(),
  }
}

function renderImports(imports: ClientImports) {
  return Object.entries(imports).map(
    ([source, spec]) =>
      `import ${
        typeof spec === 'string'
          ? spec
          : '{ ' +
            spec
              .map(spec =>
                typeof spec === 'string' ? spec : spec[0] + ' as ' + spec[1]
              )
              .join(', ') +
            ' }'
      } from "${source}"`
  )
}

type Promisable<T> = T | PromiseLike<T>

type ClientImports = {
  [source: string]: string | (string | [name: string, alias: string])[]
}

export type ClientDescription = {
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

/** Function that generates a client module */
export type ClientProvider = (
  context: ClientContext
) => Promisable<SourceDescription | ClientDescription | void>

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
   * These functions should run in order before the `renderFn`
   * has its logic executed.
   */
  beforeRenderFns: NodePath<t.ArrowFunctionExpression>[]
  /**
   * Extract a node to be used in the generated client.
   *
   * Returns a `MagicString` that remembers where the node was
   * taken from, so sourcemaps are accurate. Add it to a `MagicBundle`
   * with its `addSource` method, then call `toString` and `generateMap`
   * on the bundle.
   */
  extract: (path: NodePath) => MagicString
  /**
   * Replace an AST node with another AST node or a source string.
   */
  replaceWith: (path: NodePath, replacement: babel.Node | string) => void
  /**
   * Remove an AST node.
   */
  remove: (path: NodePath) => void
}
