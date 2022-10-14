type AnyFn = (...args: any[]) => any
type MethodOf<T> = {
  [P in keyof T]: T[P] extends AnyFn | undefined ? P : never
}[keyof T]

export async function callPlugins<T, P extends MethodOf<T>>(
  plugins: readonly T[],
  method: P,
  ...args: Parameters<Extract<T[P], AnyFn>>
): Promise<void> {
  for (const plugin of plugins) {
    if (typeof plugin[method] == 'function') {
      await (plugin[method] as any)(...args)
    }
  }
}
