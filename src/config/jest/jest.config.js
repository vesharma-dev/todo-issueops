const path = require('path');

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Point to the project root from the config file's location
  rootDir: path.join(__dirname, '../../../'),
  // Look for tests in the src directory
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
};
