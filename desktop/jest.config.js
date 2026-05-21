module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/main/**/*.js',
    'src/shared/**/*.js',
    '!src/main/main.js'
  ],
  coverageDirectory: '<rootDir>/coverage',
  moduleNameMapper: {
    '^@nut-tree-fork/nut-js$': '<rootDir>/tests/mocks/nut-js.js',
    '^electron$': '<rootDir>/tests/mocks/electron.js',
    '^firebase/app$': '<rootDir>/tests/mocks/firebase-app.js',
    '^firebase/auth$': '<rootDir>/tests/mocks/firebase-auth.js',
    '^firebase/database$': '<rootDir>/tests/mocks/firebase-database.js'
  },
  clearMocks: true,
  verbose: true
};
