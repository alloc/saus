import fs from 'fs'
import path from 'path'
import * as vite from 'vite'
import { babel, t, NodePath } from '../babel'
import { Context } from '../context'
import { SourceDescription } from '../vite'

const routesPath = path.resolve(__dirname, '../client/routes.ts')

export function routesPlugin(context: Context): vite.Plugin {
  return {
    name: 'saus:routes',
    enforce: 'pre',
    async resolveId(id, importer) {
      if (importer == routesPath) {
        return this.resolve(id, context.routesPath, { skipSelf: true })
      }
    },
    load(id) {
      if (id == routesPath) {
        return generateClientRoutes(context)
      }
    },
  }
}

function generateClientRoutes({ routesPath }: Context) {
  const routesModule = babel.parseSync(fs.readFileSync(routesPath, 'utf8'), {
    filename: routesPath,
    plugins: /\.tsx?$/.test(routesPath)
      ? [['@babel/syntax-typescript', { isTSX: routesPath.endsWith('x') }]]
      : [],
  })!

  const exports: t.ObjectProperty[] = []
  babel.traverse(routesModule, {
    CallExpression(path) {
      const callee = path.get('callee')
      if (callee.isIdentifier({ name: 'defineRoutes' })) {
        const routes = path.get('arguments')[0] as NodePath<t.ObjectExpression>
        for (const property of routes.get('properties')) {
          if (property.isObjectProperty()) {
            const value = property.get('value')

            // () => import(...)
            if (value.isArrowFunctionExpression()) {
              exports.push(property.node)
            }

            // { import: () => import(...) }
            else if (value.isObjectExpression()) {
              const importProp = value
                .get('properties')
                .find(
                  property =>
                    property.isObjectProperty() &&
                    property.get('key').isIdentifier({ name: 'import' })
                )

              if (importProp?.isObjectProperty())
                exports.push(
                  t.objectProperty(property.node.key, importProp.node.value)
                )
            }
          }
        }
      }
    },
  })

  const transformer: babel.Visitor = {
    ObjectExpression(path) {
      path.node.properties.push(...exports)
    },
  }

  return babel.transformSync(`export default {}`, {
    plugins: [{ visitor: transformer }],
  }) as SourceDescription
}
