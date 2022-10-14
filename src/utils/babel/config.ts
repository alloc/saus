import * as babel from '@babel/core'

export function getBabelConfig(
  filename: string,
  config: babel.TransformOptions | babel.PluginItem[] = {}
): babel.TransformOptions {
  if (Array.isArray(config)) {
    config = { plugins: config }
  }
  const syntaxPlugins = inferSyntaxPlugins(filename)
  if (syntaxPlugins.length) {
    config.plugins = syntaxPlugins.concat(config.plugins || [])
  }
  return {
    filename,
    babelrc: false,
    configFile: false,
    sourceMaps: true,
    ...config,
  }
}

let babelTypeScriptSyntax: string

export function inferSyntaxPlugins(filename: string): babel.PluginItem[] {
  if (/\.tsx?$/.test(filename)) {
    babelTypeScriptSyntax ||= require.resolve('@babel/plugin-syntax-typescript')
    return [[babelTypeScriptSyntax, { isTSX: filename.endsWith('x') }]]
  }
  return []
}
