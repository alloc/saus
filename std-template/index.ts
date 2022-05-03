/**
 * Unsupported patterns:
 *   - first-class elements
 *   - dynamic element types
 *   - higher-order components
 */

interface SourceFile {
  /** File identifier (before Vite resolution) */
  id: string
}

interface Location {
  /** The file this node originates from */
  source: SourceFile
  /** Character offset where this node begins */
  start: number
  /** Character offset where this node ends */
  end: number
}

interface Node {
  loc?: Location
}

/** An identifier for a variable */
interface Name extends Node {
  name: string
}

interface ComponentProp extends Node {
  id: string
  alias?: Name
  defaultValue?: Expression
}

interface ComponentRestProp extends Node {
  rest: string
}

/** Components are functions that take props and produce elements. */
interface Component extends Node {
  name: string
  /** Either the identifier of the props object, or a list of destructured props. */
  props?: Name | (ComponentProp | ComponentRestProp)[]
  body: Body
}

type Body = (Statement | Element)[]

/**
 * Component from another file.  \
 * Used by template languages with implicit imports.
 */
interface ComponentRef extends Node {
  id: string
  source: SourceFile
}

type Element = PrimitiveElement | CompositeElement
type ElementProps = Record<string, ElementProp>

interface ElementProp extends Node {
  name: string | Expression
  value: true | string | Expression
}

interface ElementSpreadProp extends Node {
  spread: RawExpression
}

interface UnknownElement extends Node {
  props: (ElementProp | ElementSpreadProp)[]
  body?: Body
}

interface PrimitiveElement extends UnknownElement {
  type: string
}

interface CompositeElement extends UnknownElement {
  type: Component | ComponentRef
  params?: Name[]
}

interface ErrorBoundary {
  try: Body
  catch: Body
}

/** Enables HTML streaming and render-driven data loading */
interface AsyncBoundary {
  async: Body
  catch?: Body
}

interface ContextProvider {
  provide: Context[]
  /** If undefined, the context is accessible to all elements declared in the nearest scope. */
  body?: Body
}

interface Context extends Node {
  id: string
  value?: Expression
  namespace?: string
}

interface ContextConsumer {
  consume: Context[]
  /** If undefined, the context is accessible to the nearest scope. */
  body?: Body
}

/** Used for conditional rendering */
interface Switch {
  switch: SwitchCase[]
  else?: Body
}

/** Render this element if `match` is truthy */
interface SwitchCase extends Node {
  case: RawExpression
  body: Body
}

/**
 * Used for mapping an object `Expression` into a list
 * of `Element` objects.
 */
interface ForIn {
  forIn: Expression
  key?: Name
  value: Name
  body: Body
}

/**
 * Used for mapping an iterable `Expression` into a list
 * of `Element` objects.
 */
interface ForOf {
  forOf: Expression
  index?: Name
  value: Name
  body: Body
}

/** JavaScript expression */
type RawExpression = string

/** Evaluated as a JavaScript expression. */
interface Expression extends Node {
  /** JavaScript expression */
  expression: RawExpression
}

/** One or more JavaScript statements. */
interface Statement extends Node {
  /** JavaScript statements separated by `\n` or `;` */
  statement: string
}
