module.exports = {
  collectCoverageFrom: ['src/**/*.ts'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^saus$': '<rootDir>/src/index.ts',
  },
  transform: {
    '\\.tsx?$': ['esbuild-jest', { sourcemap: true }],
  },
}
