module.exports = {
  // Test environment - use node since we're testing VS Code extension code
  testEnvironment: 'node',

  // TypeScript transformation
  preset: 'ts-jest',

  // Test file patterns
  testMatch: [
    '**/test/**/*.test.ts',
    '**/test/**/*.spec.ts',
    '**/__tests__/**/*.ts'
  ],

  // Files to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/out/',
    '/dist/',
    '/tests/',     // Our old test files
    '/jstests/',   // Our old JS test files
    '/docs/',
    '/notes/',
    '/src/test/'   // Ignore old VS Code test files
  ],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Transform configuration
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        isolatedModules: true
      }
    }]
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/test/**',
    '!**/node_modules/**'
  ],

  // Coverage thresholds (optional - adjust as needed)
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],
  // Module name mapping for absolute imports (if needed)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  // Reset modules between tests
  resetModules: true
};
