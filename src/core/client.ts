import fs from 'fs'
import md5Hex from 'md5-hex'
import {
  flattenCallChain,
  isChainedCall,
  MagicBundle,
  MagicString,
  NodePath,
  removeSSR,
  resolveReferences,
  t,
  transformSync,
} from '../babel'
import type { BeforeRenderHook } from './render'
import type { Renderer } from './renderer'
import type { RouteParams } from './routes'
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
  beforeRender: ClientFunction[]
  render: RenderFunction[]
}

export function extractClientFunctions(
  filename: string,
  renderers: Renderer<string | null | void>[],
  defaultRenderer: Renderer<string> | undefined
): ClientFunctions {
  if (defaultRenderer) {
    renderers = renderers.concat(defaultRenderer)
  }

  const rawSource = fs.readFileSync(filename, 'utf8')
  const source = new MagicString(rawSource, {
    filename,
    indentExclusionRanges: [],
  })

  let program!: NodePath<t.Program>
  const visitor: babel.Visitor = {
    Program: path => {
      program = path
      path.stop()
    },
  }

  // Use the AST for traversal, but not code generation.
  transformSync(rawSource, filename, {
    plugins: [{ visitor }],
    sourceMaps: false,
    code: false,
  })

  const beforeRenderFns: NodePath<t.ArrowFunctionExpression>[] = []
  const renderFns: NodePath<t.ArrowFunctionExpression>[] = []
  const didRenderFns: Record<number, NodePath<t.ArrowFunctionExpression>> = {}

  program.get('body').forEach(path => {
    const isRenderCall = renderers.some(
      renderer => renderer.start === path.node.start
    )
    if (isRenderCall) {
      const renderStmt = path
      const start = renderStmt.node.start!

      renderStmt.traverse({
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

              const methodId = thenCall.get('callee').get('property').node.name
              if (methodId !== 'then') {
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
    } else {
      const exprPath =
        path.isExpressionStatement() &&
        (path.get('expression') as NodePath<t.Expression>)

      const callPath =
        (exprPath &&
          exprPath.isCallExpression() &&
          exprPath.get('callee').isIdentifier({ name: 'beforeRender' }) &&
          (exprPath as NodePath<t.CallExpression>)) ||
        null

      const calleePath = callPath?.get('callee')
      if (calleePath?.isIdentifier({ name: 'beforeRender' })) {
        for (const arg of callPath!.get('arguments')) {
          if (arg.isArrowFunctionExpression()) {
            beforeRenderFns.push(arg)
            break
          }
        }
      }
    }
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

export async function getClient(
  functions: ClientFunctions,
  { client, start }: Renderer,
  usedHooks: BeforeRenderHook[]
): Promise<Client | undefined> {
  if (client) {
    const result = renderClient(
      client,
      functions.render.find(fn => fn.start === start)!,
      functions.beforeRender.filter(fn =>
        usedHooks.some(usedHook => fn.start === usedHook.start)
      )
    )
    const hash = md5Hex(result.code).slice(0, 16)
    return {
      id: `client.${hash}.js`,
      ...result,
    }
  }
}

function renderClient(
  client: ClientDescription,
  renderFn: RenderFunction,
  beforeRenderFns?: ClientFunction[]
) {
  const script = new MagicBundle()
  const imports = [
    `import { onHydrate as $onHydrate } from "saus/client"`,
    ...renderImports(client.imports),
  ]

  // The container for top-level statements
  const topLevel = new MagicString(imports.join('\n') + '\n')
  script.addSource(topLevel)

  // The $onHydrate callback
  const onHydrate = new MagicString('')
  script.addSource(onHydrate)

  const usedStatements = new Set<string>()
  const insertFunction = (fn: ClientFunction, name: string) => {
    for (const stmt of fn.referenced) {
      if (usedStatements.has(stmt)) continue
      usedStatements.add(stmt)
      topLevel.append(stmt + '\n')
    }
    topLevel.append(`const ${name} = ${fn.function}`)
    onHydrate.append(`${name}(request)\n`)
  }

  beforeRenderFns?.forEach((fn, i) => {
    insertFunction(fn, `$beforeRender${i + 1}`)
  })

  insertFunction(renderFn, `$render`)
  if (renderFn.didRender) {
    insertFunction(renderFn.didRender, `$didRender`)
  }

  onHydrate
    .append(`const content = await $render(routeModule, request)`)
    .append(client.onHydrate)

  // Indent the function body, then wrap with $onHydrate call.
  onHydrate
    .indent('  ')
    .prepend(`$onHydrate(async (routeModule, request) => {`)
    .append(`})`)

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

type ClientImports = {
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
