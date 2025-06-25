/**
 * Simple Integration Tests for Pathfinder Extension
 * 
 * These tests validate key integration points:
 * - Configuration persistence
 * - Response handling for different sizes
 * - Basic component initialization
 */

import * as vscode from 'vscode';
import { ConfigurationManager } from '../../src/configuration';
import { ResponseHandler } from '../../src/response-handler';

// Mock VS Code API
jest.mock('vscode', () => ({
    workspace: {
        getConfiguration: jest.fn(() => ({
            get: jest.fn(),
            update: jest.fn()
        }))
    },
    window: {
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn()
    },
    Uri: {
        parse: jest.fn((str: string) => ({ toString: () => str }))
    },
    commands: { executeCommand: jest.fn() },
    NotebookCellOutput: jest.fn().mockImplementation((items) => ({ items })),
    NotebookCellOutputItem: {
        text: jest.fn((text, mime) => ({ data: Buffer.from(text), mime })),
        json: jest.fn((data, mime) => ({ data: Buffer.from(JSON.stringify(data)), mime }))
    }
}));

describe('Pathfinder Core Integration Tests', () => {
    let configManager: ConfigurationManager;
    let extensionContext: vscode.ExtensionContext;

    beforeEach(() => {
        // Mock extension context
        extensionContext = {
            subscriptions: [],
            workspaceState: {
                get: jest.fn(() => undefined),
                update: jest.fn(),
                keys: jest.fn(() => [])
            },
            globalState: {
                get: jest.fn(() => []),
                update: jest.fn(),
                keys: jest.fn(() => [])
            },
            secrets: {
                get: jest.fn(),
                store: jest.fn(),
                delete: jest.fn(),
                onDidChange: jest.fn()
            }
        } as any;

        configManager = new ConfigurationManager(extensionContext);
    });

    describe('Configuration Manager Integration', () => {
        test('should initialize without errors', () => {
            expect(configManager).toBeDefined();
            expect(extensionContext.globalState.get).toHaveBeenCalled();
        });

        test('should handle empty configuration state', async () => {
            const schemas = await configManager.getApiSchemas();
            expect(schemas).toEqual([]);

            const environments = await configManager.getSchemaEnvironments();
            expect(environments).toEqual([]);
        });
    });

    describe('Response Handler Integration', () => {
        test('should handle small JSON responses without truncation', async () => {
            const smallResponse = {
                users: [
                    { id: 1, name: 'Alice', email: 'alice@example.com' },
                    { id: 2, name: 'Bob', email: 'bob@example.com' }
                ],
                total: 2
            };

            const jsonString = JSON.stringify(smallResponse, null, 2);
            expect(jsonString.length).toBeLessThan(1000); // Small response

            const mockUri = { toString: () => 'test:small-response' } as vscode.Uri;
            const output = await ResponseHandler.handleApiResponse(jsonString, mockUri);

            expect(output).toBeDefined();
            expect(output.items).toHaveLength(1);
            expect(output.items[0].mime).toBe('application/json');
        });

        test('should truncate large JSON responses', async () => {
            // Create a large response (>100KB)
            const largeResponse = {
                data: Array.from({ length: 5000 }, (_, i) => ({
                    id: i,
                    name: `User ${i}`,
                    description: 'Test environment for API integration testing',
                    metadata: {
                        created: new Date().toISOString(),
                        tags: Array.from({ length: 10 }, (_, j) => `tag-${j}`),
                        properties: {
                            prop1: `value-${i}`,
                            prop2: Math.random(),
                            prop3: i % 2 === 0,
                            prop4: `description-${i}`.repeat(10)
                        }
                    }
                }))
            };

            const jsonString = JSON.stringify(largeResponse);
            expect(jsonString.length).toBeGreaterThan(100000); // Large response

            const mockUri = { toString: () => 'test:large-response' } as vscode.Uri;
            const output = await ResponseHandler.handleApiResponse(jsonString, mockUri);

            expect(output).toBeDefined();
            expect(output.items).toHaveLength(1);
            expect(output.items[0].mime).toBe('text/html');

            // Check that HTML contains truncation notice
            const htmlContent = Buffer.from(output.items[0].data).toString();
            expect(htmlContent).toContain('Response too large');
            expect(htmlContent).toContain('Open Full Response');
            expect(htmlContent).toContain('vscode.postMessage');
        });

        test('should handle non-JSON responses gracefully', async () => {
            const textResponse = 'This is a plain text response from the API.';
            const mockUri = { toString: () => 'test:text-response' } as vscode.Uri;
            
            const output = await ResponseHandler.handleApiResponse(textResponse, mockUri);

            expect(output).toBeDefined();
            expect(output.items).toHaveLength(1);
            expect(output.items[0].mime).toBe('text/plain');
        });

        test('should handle empty responses', async () => {
            const emptyResponse = '';
            const mockUri = { toString: () => 'test:empty-response' } as vscode.Uri;
            
            const output = await ResponseHandler.handleApiResponse(emptyResponse, mockUri);

            expect(output).toBeDefined();
            expect(output.items).toHaveLength(1);
            expect(output.items[0].mime).toBe('text/plain');
        });
    });

    describe('Error Handling Integration', () => {
        test('should handle configuration errors gracefully', async () => {
            // Simulate error in globalState
            const errorContext = {
                ...extensionContext,
                globalState: {
                    get: jest.fn().mockImplementation(() => {
                        throw new Error('Storage error');
                    }),
                    update: jest.fn(),
                    keys: jest.fn(() => [])
                }
            } as any;

            // Should not throw when creating config manager
            expect(() => {
                new ConfigurationManager(errorContext);
            }).not.toThrow();
        });

        test('should handle malformed JSON in responses', async () => {
            const malformedJson = '{"incomplete": "json"'; // Missing closing brace
            const mockUri = { toString: () => 'test:malformed' } as vscode.Uri;
            
            // Should not throw
            const output = await ResponseHandler.handleApiResponse(malformedJson, mockUri);
            
            expect(output).toBeDefined();
            expect(output.items).toHaveLength(1);
            // Should fall back to text/plain for malformed JSON
            expect(output.items[0].mime).toBe('text/plain');
        });
    });

    describe('Storage Integration', () => {
        test('should interact with VS Code storage APIs correctly', async () => {
            const mockGet = extensionContext.globalState.get as jest.Mock;
            const mockUpdate = extensionContext.globalState.update as jest.Mock;

            // Simulate getting schemas (should call get)
            await configManager.getApiSchemas();
            expect(mockGet).toHaveBeenCalledWith('apiSchemas', []);

            // Simulate saving a schema (would call update in real implementation)
            const testSchema = {
                id: 'test-schema',
                name: 'Test Schema',
                version: '1.0.0',
                isValid: true,
                description: 'Test schema for integration testing',
                schema: {
                    openapi: '3.0.0',
                    info: { title: 'Test', version: '1.0.0' },
                    paths: {}
                },
                source: 'test',
                loadedAt: new Date(),
                lastUpdated: new Date(),
                platform: 'generic'
            };

            await configManager.saveApiSchema(testSchema);
            expect(mockUpdate).toHaveBeenCalled();
        });
    });

    describe('Component Interaction', () => {
        test('should handle VS Code API mocking correctly', () => {
            // Verify our mocks are working
            expect(vscode.workspace.getConfiguration).toBeDefined();
            expect(vscode.window.showInformationMessage).toBeDefined();
            expect(vscode.Uri.parse).toBeDefined();
            expect(vscode.commands.executeCommand).toBeDefined();

            // Test mock functionality
            const config = vscode.workspace.getConfiguration();
            expect(config.get).toBeDefined();
            expect(config.update).toBeDefined();

            const uri = vscode.Uri.parse('test:uri');
            expect(uri.toString()).toBe('test:uri');
        });
    });
});
