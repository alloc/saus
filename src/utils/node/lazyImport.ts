export const lazyImport: <T = any>(id: string) => Promise<T> = (0, eval)(
  'id => import(id)'
)
