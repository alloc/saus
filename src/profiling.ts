export const Profiling = process.env.PROFILE
  ? require('elaps')()
  : { mark() {} }
