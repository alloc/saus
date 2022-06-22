import { CamelCase } from 'type-fest'

export type CamelCasedPropertiesDeep<Value> = Value extends Function
  ? Value
  : Value extends Array<infer U>
  ? Array<CamelCasedPropertiesDeep<U>>
  : Value extends Set<infer U>
  ? Set<CamelCasedPropertiesDeep<U>>
  : Value extends { [Symbol.iterator]: any } | { [Symbol.toPrimitive]: any }
  ? Value
  : {
      [K in keyof Value as CamelCase<K>]: CamelCasedPropertiesDeep<Value[K]>
    }
