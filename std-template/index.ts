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

interface Text extends Node {
  text: string | Expression
  escape?: boolean
}

/** Bodies have their own variable scope. */
type Body = (Statement | Element | Text)[]

/** Used for the render-props pattern */
interface CallableBody extends Node {
  params?: ParameterList
  body: Body
}

type ParameterList = (Parameter | RestParameter)[]

interface Parameter extends Node {
  id: string
  alias?: Name
  defaultValue?: Expression
}

interface RestParameter extends Node {
  rest: string
}

/** Components are functions that take props and produce elements. */
interface Component extends Node {
  name: string
  /** Either the identifier of the props object, or a list of destructured props. */
  props?: Name | ParameterList
  body: Body
}

/**
 * Component from another file.  \
 * Used by template languages with implicit imports.
 */
interface ComponentRef extends Node {
  id: string
  source: SourceFile
}

type Element = PrimitiveElement | CompositeElement | SlotElement

interface PrimitiveElement extends UnknownElement {
  type: string
  body?: Body
}

interface CompositeElement extends UnknownElement {
  type: Component | ComponentRef
}

interface UnknownElement extends Node {
  props?: (ElementProp | ElementSpreadProp)[]
  slots?: Slot[]
  body?: Body | CallableBody
}

interface ElementProp extends Node {
  name: string
  value: true | string | Expression
}

interface ElementSpreadProp extends Node {
  spread: RawExpression
}

/** How a caller defines the contents of a named slot. */
interface Slot extends Node {
  /** Cannot be an empty string. */
  slot: string
  body: Body
}

/** The body of an element is placed here within the component. */
interface SlotElement extends Node {
  /** Use empty string for default slot. */
  slot: string
  /** If component receives empty body, this is used. */
  fallback?: Body
}

interface ErrorBoundary {
  try: Body
  catch: Body | CallableBody
}

/** Enables HTML streaming and render-driven data loading */
interface AsyncBoundary {
  async: Body
  catch?: Body | CallableBody
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
  local: Name
  /** If undefined, the context is accessible to the nearest scope. */
  body?: Body
}

/** Used for conditional rendering */
interface Switch {
  switch: SwitchCase[]
  else?: Body
}

/** Render the body if `case` is truthy */
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
