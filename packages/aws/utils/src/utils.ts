// fooBar -> FooBar
export function pascalize(key: string) {
  return key[0].toUpperCase() + key.slice(1)
}

// FooBar -> fooBar
export function camelize(key: string) {
  return key[0].toLowerCase() + key.slice(1)
}
