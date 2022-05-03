/**
 * Unsupported patterns:
 *   - first-class elements
 *   - dynamic element types
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

/**
 * Some template compilers may be able to infer the effective props/body
 * of a higher-order component, so SSR optimizations are still possible.
 */
interface ComponentExpression extends Component {
  init: Expression
}

type Element = PrimitiveElement | CompositeElement | SlotElement

interface PrimitiveElement extends UnknownElement {
  type: string
  body?: Body
}

interface CompositeElement extends UnknownElement {
  type: Component | ComponentRef
  /**
   * If the component uses a `Return` node, this is the
   * local identifier in this element's scope.
   */
  ref?: Name
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

interface ErrorBoundary extends Node {
  try: Body
  catch: Body | CallableBody
}

/** Enables HTML streaming and render-driven data loading */
interface AsyncBoundary extends Node {
  async: Body
  catch?: Body | CallableBody
}

interface ContextProvider extends Node {
  provide: Context[]
  /** If undefined, the context is accessible to all elements declared in the nearest scope. */
  body?: Body
}

interface Context extends Node {
  id: string
  value?: Expression
  namespace?: string
}

interface ContextConsumer extends Node {
  consume: Context[]
  local: Name
  /** If undefined, the context is accessible to the nearest scope. */
  body?: Body
}

/** Expose a value to the caller */
interface Return extends Node {
  return: Expression
}

/** Used for conditional rendering */
interface Switch extends Node {
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
interface ForIn extends Node {
  forIn: Expression
  key?: Name
  value: Name
  body: Body
}

/**
 * Used for mapping an iterable `Expression` into a list
 * of `Element` objects.
 */
interface ForOf extends Node {
  forOf: Expression
  index?: Name
  value: Name
  body: Body
}
