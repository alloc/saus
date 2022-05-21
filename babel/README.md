# saus/babel

Helpers for client code generation

⚠️ Avoid using this in your SSR bundle! It's intended for Saus plugins.

## Exports

- `babel`  
  The [`@babel/core`](https://babeljs.io/docs/en/babel-core) module exports

- `t`  
  Identical to [`babel.types`](https://babeljs.io/docs/en/babel-types)

- `transformSync`  
  Shortcut for `babel.transformSync` with configuration files like `.babelrc` and `babel.config.js` disabled, source maps enabled, and syntax plugins inferred from the file extension.

- `inferSyntaxPlugins`  
  Check the given filename and return appropriate Babel syntax plugins.

- `MagicString`  
  A string manipulator that can generate sourcemaps. [Learn more](https://www.npmjs.com/package/magic-string)

- `MagicBundle`  
  Basically an array of `MagicString` objects with sourcemap support. [Learn more](https://www.npmjs.com/package/magic-string#bundling)

- `resolveReferences`  
  Given a node path for an arrow function, this will find all references to declarations outside the arrow function and return their node paths in order of appearance. This is useful for extracting only the logic used by a given arrow function.

- `getImportDeclaration`  
  Find an import declaration with the given module specifier. The first occurrence is returned.

- `getImportDeclarations`  
  Find all import declarations in a module.

- `getFirstAncestor`  
  For the given node path, return the first matching ancestor path.

- `isConsoleCall`  
  Returns true if the given node path is a `console.xxx` call.

- `isPropertyName`  
  Returns true if the given node path is either…

  - the name of an object property being declared
  - the name of a property being accessed

- `isChainedCall`  
  Returns true if the given node path points to a `t.MemberExpression` whose object is a`t.CallExpression` and whose parent is a `t.CallExpression`. For example, in a `render().then()` expression, the node path for `.then` will result in true.

- `flattenCallChain`  
  Given a node path for a `t.CallExpression` or a node path where `isChainedCall` returns true, this function returns all calls in order. For the following expression…

  ```ts
  a().b().c()
  ```

  …it will return an array of node paths where `a()` comes first, then `b()`, then `c()`.

- `remove`  
  Remove a node path from a `MagicString`, including any preceding whitespace and a trailing line break. Useful for tree-shaking.

## Type Exports

- `NodePath`  
  Working with node paths is recommended, as opposed to traversing nodes directly. This type is combined with `t.Node` types, so `NodePath<t.CallExpression>` for example is provided to a Babel visitor with a `CallExpression` method.
