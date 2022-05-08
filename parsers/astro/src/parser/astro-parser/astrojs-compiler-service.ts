import fs from "fs"
import * as resolve from "resolve"
import Go from "./wasm_exec"
import type { ParseOptions, ParseResult } from "@astrojs/compiler"
const go = new Go()
const wasmBuffer = fs.readFileSync(
    resolve.sync("@astrojs/compiler/astro.wasm", {
        basedir: import.meta.url,
    }),
)
const mod = new WebAssembly.Module(wasmBuffer)
const instance = new WebAssembly.Instance(mod, go.importObject)
void go.run(instance)
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
