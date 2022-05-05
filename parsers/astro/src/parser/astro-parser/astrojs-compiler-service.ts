import type { ParseOptions, ParseResult } from "@astrojs/compiler";
const service = (globalThis as any)["@astrojs/compiler"] as {
    parse: (code: string, options: ParseOptions) => { ast: string }
}

/**
 * Parse code by `@astrojs/compiler`
 */
export function parse(code: string, options: ParseOptions): ParseResult {
    const ast = JSON.parse(service.parse(code, options).ast)
    return { ast }
}
