import type { BabelOptions } from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

export { default } from '@vitejs/plugin-react'

/**
 * This plugin requires `@vitejs/plugin-react` (or `@saus/react`) to work.
 *
 * Almost identical to using the `babel` option of `@vitejs/plugin-react` plugin,
 * but you have more control of plugin order in scenarios where other Vite plugins
 * are adding their own plugins. For example, you can use the `enforce` option or
 * simply place this plugin ahead/behind another plugin in your Vite config.
 */
export function reactBabel({
  apply,
  enforce,
  plugins,
  presets,
  overrides,
  parserOpts,
  ...babelOptions
}: BabelOptions & {
  apply?: 'serve' | 'build'
  enforce?: 'pre' | 'post'
}): Plugin {
  return {
    name: 'saus:react-babel',
    apply,
    enforce,
    api: {
      reactBabel(options, config) {
        concatInPlace(options.plugins, plugins)
        concatInPlace(options.presets, presets)
        concatInPlace(options.overrides, overrides)
        Object.assign(options, babelOptions)
        Object.assign(options.parserOpts, parserOpts, {
          plugins: concatInPlace(
            options.parserOpts.plugins,
            parserOpts?.plugins
          ),
        })
      },
    },
  }
}

function concatInPlace(a: any[], b: any[] | undefined) {
  b && b.forEach(c => a.push(c))
  return a
}
