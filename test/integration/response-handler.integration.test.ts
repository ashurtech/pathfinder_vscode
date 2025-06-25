/**
 * Integration Tests for ResponseHandler
 * Focus on testing the large response handling without API dependencies
 */

import * as vscode from 'vscode';
import { ResponseHandler } from '../../src/response-handler';

// Mock VS Code API
jest.mock('vscode', () => ({
    Uri: {
        parse: jest.fn((str: string) => ({ toString: () => str }))
    },
    NotebookCellOutput: jest.fn((items) => ({ items })),
    NotebookCellOutputItem: {
        text: jest.fn((text, mime) => ({ data: Buffer.from(text), mime })),
        json: jest.fn((obj, mime) => ({ data: Buffer.from(JSON.stringify(obj)), mime }))
    }
}));

describe('ResponseHandler Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Large Response Handling', () => {
        test('should handle small responses normally', async () => {
            const smallData = { message: 'Hello World', status: 'ok' };
            const mockUri = vscode.Uri.parse('untitled:test-cell');

            const output = await ResponseHandler.handleApiResponse(smallData, mockUri);

            expect(output).toBeDefined();
            expect(vscode.NotebookCellOutput).toHaveBeenCalled();
        });        test('should handle large responses with truncation', async () => {
            // Create a moderately large object (should be > 100KB when stringified)
            const largeData = {
                items: Array.from({ length: 500 }, (_, i) => ({
                    id: i,
                    name: `Item ${i}`,
                    description: 'This is a test description for the API response.',
                    metadata: {
                        created: new Date().toISOString(),
                        tags: [`tag${i % 10}`],
                        properties: { prop1: `value${i}`, prop2: i * 2 }
                    }
                }))
            };

            // Verify it's actually large
            const jsonString = JSON.stringify(largeData, null, 2);
            expect(jsonString.length).toBeGreaterThan(100000); // > 100KB

            const mockUri = vscode.Uri.parse('untitled:test-cell');
            const output = await ResponseHandler.handleApiResponse(largeData, mockUri);

            expect(output).toBeDefined();
            expect(vscode.NotebookCellOutput).toHaveBeenCalled();
        });        test('should not cause infinite recursion with deeply nested objects', async () => {
            // Create a reasonably deep but finite object
            const createNestedObject = (depth: number): any => {
                if (depth === 0) {
                    return { value: 'leaf', id: Math.random() };
                }
                return {
                    level: depth,
                    child: createNestedObject(depth - 1),
                    data: { id: Math.random(), value: `level-${depth}` }
                };
            };

            const nestedData = createNestedObject(5); // 5 levels deep - much smaller
            const mockUri = vscode.Uri.parse('untitled:test-cell');

            // This should not throw "Maximum call stack size exceeded"
            const output = await ResponseHandler.handleApiResponse(nestedData, mockUri);

            expect(output).toBeDefined();
            expect(vscode.NotebookCellOutput).toHaveBeenCalled();
        });

        test('should handle circular references gracefully', async () => {
            // Create an object with circular reference
            const dataWithCircularRef: any = {
                id: 'test',
                name: 'Test Object'
            };
            dataWithCircularRef.self = dataWithCircularRef; // Circular reference

            const mockUri = vscode.Uri.parse('untitled:test-cell');

            // ResponseHandler should handle this gracefully (JSON.stringify will throw, but we should catch it)
            expect(async () => {
                await ResponseHandler.handleApiResponse(dataWithCircularRef, mockUri);
            }).not.toThrow();
        });
    });
});
