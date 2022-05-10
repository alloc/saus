import type { AttributeNode, CommentNode, DoctypeNode, Node, ParentNode, TagLikeNode } from "@astrojs/compiler/types";

/**
 * Checks if the given node is TagLikeNode
 */
export function isTag(node: Node): node is Node & TagLikeNode {
    return (
        node.type === "element" ||
        node.type === "custom-element" ||
        node.type === "component" ||
        node.type === "fragment"
    )
}

/**
 * Checks if the given node is ParentNode
 */
export function isParent(node: Node): node is ParentNode {
    return Array.isArray((node as any).children)
}

/** walk nodes */
export function walk(
    parent: ParentNode,
    code: string,
    enter: (n: Node | AttributeNode, parent: ParentNode) => void,
    leave?: (n: Node | AttributeNode, parent: ParentNode) => void,
): void {
    const children = getSortedChildren(parent, code)
    for (const node of children) {
        enter(node, parent)
        if (isTag(node)) {
            for (const attr of node.attributes) {
                enter(attr, node)
                leave?.(attr, node)
            }
        }
        if (isParent(node)) {
            walk(node, code, enter, leave)
        }
        leave?.(node, parent)
    }
}

/**
 * Skip spaces
 */
export function skipSpaces(string: string, position: number): number {
    const re = /\s*/g
    re.lastIndex = position
    const match = re.exec(string)
    if (match) {
        return match.index + match[0].length
    }
    return position
}

/**
 * Get children
 */
function getSortedChildren(parent: ParentNode, code: string) {
    if (parent.type === "root" && parent.children[0]?.type === "frontmatter") {
        // The order of comments and frontmatter may be changed.
        const children = [...parent.children]
        if (children.every((n) => n.position)) {
            return children.sort(
                (a, b) => a.position!.start.offset - b.position!.start.offset,
            )
        }
        let start = skipSpaces(code, 0)
        if (code.startsWith("<!", start)) {
            const frontmatter = children.shift()!
            const before: (CommentNode | DoctypeNode)[] = []
            let first
            while ((first = children.shift())) {
                start = skipSpaces(code, start)
                if (
                    first.type === "comment" &&
                    code.startsWith("<!--", start)
                ) {
                    start = code.indexOf("-->", start + 4) + 3
                    before.push(first)
                } else if (
                    first.type === "doctype" &&
                    code.startsWith("<!", start)
                ) {
                    start = code.indexOf(">", start + 2) + 1
                    before.push(first)
                } else {
                    children.unshift(first)
                    break
                }
            }
            return [...before, frontmatter, ...children]
        }
    }
    return parent.children
}
