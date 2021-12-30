/**
 * Avoid creating more than one `HtmlTagPath` instance
 * per AST node by storing the instance on the node.
 */
export const kTagPath = Symbol.for('html.TagPath')

/**
 * Calls to the `traverseHtml` hook are combined to reduce
 * the number of full AST traversals to a maximum of 3.
 */
export const kVisitorsArray = Symbol.for('html.VisitorsArray')

/** Indicates a removed or replaced node */
export const kRemovedNode = Symbol.for('html.RemovedNode')
