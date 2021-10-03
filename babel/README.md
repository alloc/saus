# saus/babel

Helpers for client code generation

## Exports

- `babel`  
  The [`@babel/core`](https://babeljs.io/docs/en/babel-core) module exports

- `t`  
  Identical to [`babel.types`](https://babeljs.io/docs/en/babel-types)

- `MagicString`  
  A string manipulator that can generate sourcemaps. [Learn more](https://www.npmjs.com/package/magic-string)

- `MagicBundle`  
  Basically an array of `MagicString` objects with sourcemap support. [Learn more](https://www.npmjs.com/package/magic-string#bundling)

- `parseFile`  
  Parse the given `filename` (and optional `source` code) with Babel, and return a `saus.File` object with methods for extracting a portion of the module with sourcemap support.  
  Basically, you can call `file.extract(start, end)` for a `MagicString` that can be added to a `MagicBundle` to generate a client that reuses nodes from the render call. If I'm confusing you, check out [this example](https://github.com/alloc/saus/blob/b75168eafbb2ed618be26dc98b903919de00ece5/packages/react/src/node/client.ts#L70-L74) from `./packages/react`.

- `resolveReferences`  
  Given a node path for an arrow function, this will find all references to declarations outside the arrow function and return their node paths in order of appearance. This is useful for extracting only the logic used by a given arrow function.

- `isChainedCall`  
  Returns true if the given node path points to a `t.MemberExpression` whose object is a`t.CallExpression` and whose parent is a `t.CallExpression`. For example, in a `render().then()` expression, the node path for `.then` will result in true.

- `flattenCallChain`  
  Given a node path for a `t.CallExpression` or a node path where `isChainedCall` returns true, this function returns all calls in order. For example, in an `a().b().c()` expression, this function returns an array of node paths where `a()` comes first, then `b()`, then `c()`.

- `getImportDeclaration`  
  Find an import declaration with the given module specifier. The first occurrence is returned.

- `getImportDeclarations`  
  Find all import declarations in a module.

- `getFirstAncestor`  
  For the given node path, return the first matching ancestor path.

## Type Exports

- `NodePath`  
  Working with node paths is recommended, as opposed to traversing nodes directly. This type is combined with `t.Node` types, so `NodePath<t.CallExpression>` for example is provided to a Babel visitor with a `CallExpression` method.
