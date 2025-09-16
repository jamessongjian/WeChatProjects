module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/test/**/*.test.js'],
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  setupFiles: ['./test/setup.js']
}; 