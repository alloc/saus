import { MagicBundle, MagicString } from '../babel'
import { ClientDescription } from '../core'
import { serializeImports } from '../utils/imports'
import { ClientFunction, RenderFunction } from './types'

export function renderClient(
  client: ClientDescription,
  renderFn: RenderFunction,
  beforeRenderFns?: ClientFunction[]
) {
  const script = new MagicBundle()
  const imports = [
    `import { onHydrate as $onHydrate } from "saus/client"`,
    ...serializeImports(client.imports),
  ]

  // The container for top-level statements
  const topLevel = new MagicString(imports.join('\n') + '\n')
  script.addSource(topLevel)

  // The $onHydrate callback
  const onHydrate = new MagicString('')
  script.addSource(onHydrate)

  const importedModules = new Set<string>()
  const insertFunction = (fn: ClientFunction, name: string) => {
    const { function: rawFn, referenced } = fn.transformResult || fn

    for (let stmt of referenced) {
      stmt = stmt.toString()
      if (!importedModules.has(stmt)) {
        importedModules.add(stmt)
        topLevel.append(stmt + '\n')
      }
    }

    topLevel.append(`const ${name} = ${rawFn}`)
    onHydrate.append(
      name == `$render`
        ? `let content = await $render(request.module, request)\n`
        : `${name}(request)\n`
    )
  }

  beforeRenderFns?.forEach((fn, i) => {
    insertFunction(fn, `$beforeRender${i + 1}`)
  })
  insertFunction(renderFn, `$render`)
  onHydrate.append(client.onHydrate)
  if (renderFn.didRender) {
    insertFunction(renderFn.didRender, `$didRender`)
  }

  // Indent the function body, then wrap with $onHydrate call.
  onHydrate.indent('  ')
  onHydrate.prepend(`$onHydrate(async (request) => {\n`)
  onHydrate.append(`\n})`)

  return {
    code: script.toString(),
    map: script.generateMap(),
  }
}
