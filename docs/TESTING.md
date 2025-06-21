# Unit Testing Setup

This project now includes Jest-based unit testing for core components.

## Test Structure

- `test/` - Main unit test directory
- `test/setup.ts` - Jest configuration and VS Code API mocking
- `jest.config.js` - Jest configuration file

## Available npm Scripts

- `npm run test:unit` - Run Jest unit tests
- `npm run test:unit:watch` - Run Jest tests in watch mode
- `npm run test:unit:coverage` - Run tests with coverage report
- `npm run test:unit:ci` - Run tests in CI mode (no watch, with coverage)
- `npm run test:vscode` - Run VS Code integration tests
- `npm test` - Run both unit tests and VS Code tests

## Writing Tests

### VS Code API Mocking

The test setup automatically mocks the VS Code API. The mock is available as `mockVscode` from the setup file and includes common VS Code APIs like:

- `vscode.workspace`
- `vscode.window`
- `vscode.commands`
- `vscode.Uri`
- `vscode.TreeItem`
- etc.

### Example Test

```typescript
import { ConfigurationManager } from '../src/configuration';

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      globalState: {
        get: jest.fn(),
        update: jest.fn()
      },
      secrets: {
        get: jest.fn(),
        store: jest.fn()
      }
    };

    configManager = new ConfigurationManager(mockContext);
  });

  it('should save API schema', async () => {
    const mockSchema = {
      id: 'test-schema',
      name: 'Test API',
      version: '1.0.0',
      // ... other properties
    };

    mockContext.globalState.get.mockReturnValue([]);
    
    await configManager.saveApiSchema(mockSchema);

    expect(mockContext.globalState.update).toHaveBeenCalledWith('apiSchemas', [mockSchema]);
  });
});
```

## Test Coverage

Current test coverage focuses on:

- Configuration management (API schemas, environment groups, settings)
- HTTP request building and authentication
- Basic tree provider functionality

## File Organization

Tests are organized to mirror the source structure:

- `test/configuration.test.ts` - Tests for `src/configuration.ts`
- `test/http-runner.test.ts` - Tests for `src/http-runner.ts`
- `test/tree-provider-simple.test.ts` - Tests for `src/tree-provider.ts`

## Configuration

The Jest configuration is set up to:

- Use TypeScript with ts-jest
- Mock the VS Code API globally
- Exclude old test files and build directories
- Provide coverage reporting
- Support isolated modules for better TypeScript compatibility

## Running Tests

```bash
# Run all unit tests
npm run test:unit

# Run tests in watch mode during development
npm run test:unit:watch

# Generate coverage report
npm run test:unit:coverage

# Run both unit and integration tests
npm test
```

## Troubleshooting

If you encounter TypeScript errors in tests, ensure that:

1. Test files are in the `test/` directory
2. Types are correctly imported from source files
3. Mock objects match the expected interfaces
4. The VS Code API is properly mocked in `test/setup.ts`
