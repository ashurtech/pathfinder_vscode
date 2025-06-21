import * as vscode from 'vscode';
import { NotebookProvider } from '../../src/notebook/notebook-provider';

// Mock VS Code APIs
const mockVscode = {
    NotebookCellKind: {
        Markup: 1,
        Code: 2,
    },
    NotebookCellData: class {
        constructor(
            public kind: number,
            public value: string,
            public languageId: string
        ) {}
    },
    NotebookData: class {
        constructor(public cells: any[]) {}
    },
    Uri: {
        parse: jest.fn((str: string) => ({ toString: () => str })),
    },
    workspace: {
        registerNotebookSerializer: jest.fn(),
        openNotebookDocument: jest.fn(),
    },
    window: {
        showTextDocument: jest.fn(),
    },
};

jest.mock('vscode', () => mockVscode, { virtual: true });

describe('NotebookProvider', () => {
    let notebookProvider: NotebookProvider;

    beforeEach(() => {
        jest.clearAllMocks();
        notebookProvider = new NotebookProvider();
    });

    describe('Notebook Serialization', () => {
        it('should serialize notebook to JSON format', async () => {
            const notebookData = new mockVscode.NotebookData([
                new mockVscode.NotebookCellData(
                    mockVscode.NotebookCellKind.Markup,
                    '# API Test\nThis notebook tests the user API.',
                    'markdown'
                ),
                new mockVscode.NotebookCellData(
                    mockVscode.NotebookCellKind.Code,
                    'GET https://api.example.com/users\nAuthorization: Bearer {{token}}',
                    'http'
                ),
                new mockVscode.NotebookCellData(
                    mockVscode.NotebookCellKind.Code,
                    'console.log("Response received:", JSON.parse(response));',
                    'javascript'
                ),
            ]);

            const token = new vscode.CancellationToken();
            const serialized = await notebookProvider.serializeNotebook(notebookData, token);

            const parsedData = JSON.parse(serialized.toString());
            
            expect(parsedData.cells).toHaveLength(3);
            
            // Check markdown cell
            expect(parsedData.cells[0].cell_type).toBe('markdown');
            expect(parsedData.cells[0].source).toEqual(['# API Test\n', 'This notebook tests the user API.']);
            
            // Check HTTP request cell
            expect(parsedData.cells[1].cell_type).toBe('code');
            expect(parsedData.cells[1].metadata.language).toBe('http');
            expect(parsedData.cells[1].source).toEqual([
                'GET https://api.example.com/users\n',
                'Authorization: Bearer {{token}}'
            ]);
            
            // Check JavaScript cell
            expect(parsedData.cells[2].cell_type).toBe('code');
            expect(parsedData.cells[2].metadata.language).toBe('javascript');
        });

        it('should deserialize JSON to notebook format', async () => {
            const jsonContent = JSON.stringify({
                cells: [
                    {
                        cell_type: 'markdown',
                        source: ['# Test Notebook\n', 'This is a test.'],
                        metadata: {}
                    },
                    {
                        cell_type: 'code',
                        source: ['POST https://api.example.com/data\n', 'Content-Type: application/json\n', '\n', '{"test": true}'],
                        metadata: { language: 'http' },
                        outputs: []
                    }
                ],
                metadata: {
                    pathfinder: {
                        version: '1.0.0',
                        environment: 'development'
                    }
                }
            });

            const uint8Array = new TextEncoder().encode(jsonContent);
            const token = new vscode.CancellationToken();
            
            const notebookData = await notebookProvider.deserializeNotebook(uint8Array, token);

            expect(notebookData.cells).toHaveLength(2);
            
            // Check markdown cell
            expect(notebookData.cells[0].kind).toBe(mockVscode.NotebookCellKind.Markup);
            expect(notebookData.cells[0].value).toBe('# Test Notebook\nThis is a test.');
            expect(notebookData.cells[0].languageId).toBe('markdown');
            
            // Check HTTP request cell
            expect(notebookData.cells[1].kind).toBe(mockVscode.NotebookCellKind.Code);
            expect(notebookData.cells[1].value).toBe('POST https://api.example.com/data\nContent-Type: application/json\n\n{"test": true}');
            expect(notebookData.cells[1].languageId).toBe('http');
        });

        it('should handle empty notebook', async () => {
            const notebookData = new mockVscode.NotebookData([]);
            const token = new vscode.CancellationToken();
            
            const serialized = await notebookProvider.serializeNotebook(notebookData, token);
            const parsedData = JSON.parse(serialized.toString());
            
            expect(parsedData.cells).toHaveLength(0);
            expect(parsedData.metadata).toBeDefined();
        });

        it('should preserve cell metadata during serialization', async () => {
            const cellWithMetadata = new mockVscode.NotebookCellData(
                mockVscode.NotebookCellKind.Code,
                'GET https://api.example.com/test',
                'http'
            );
            
            // Add custom metadata
            cellWithMetadata.metadata = {
                environment: 'production',
                timeout: 5000,
                retries: 3
            };

            const notebookData = new mockVscode.NotebookData([cellWithMetadata]);
            const token = new vscode.CancellationToken();
            
            const serialized = await notebookProvider.serializeNotebook(notebookData, token);
            const parsedData = JSON.parse(serialized.toString());
            
            expect(parsedData.cells[0].metadata.environment).toBe('production');
            expect(parsedData.cells[0].metadata.timeout).toBe(5000);
            expect(parsedData.cells[0].metadata.retries).toBe(3);
        });
    });

    describe('File Format Compatibility', () => {
        it('should handle legacy HTTP files for import', () => {
            const httpContent = `### Get all users
GET https://api.example.com/users
Authorization: Bearer token123

### Create a new user
POST https://api.example.com/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}`;

            const notebookData = notebookProvider.convertHttpFileToNotebook(httpContent);

            expect(notebookData.cells).toHaveLength(3); // 1 markdown + 2 http requests
            
            // First cell should be markdown
            expect(notebookData.cells[0].kind).toBe(mockVscode.NotebookCellKind.Markup);
            expect(notebookData.cells[0].value).toContain('Get all users');
            
            // Second cell should be HTTP GET
            expect(notebookData.cells[1].kind).toBe(mockVscode.NotebookCellKind.Code);
            expect(notebookData.cells[1].languageId).toBe('http');
            expect(notebookData.cells[1].value).toContain('GET https://api.example.com/users');
            expect(notebookData.cells[1].value).toContain('Authorization: Bearer token123');
            
            // Third cell should be HTTP POST
            expect(notebookData.cells[2].kind).toBe(mockVscode.NotebookCellKind.Code);
            expect(notebookData.cells[2].value).toContain('POST https://api.example.com/users');
            expect(notebookData.cells[2].value).toContain('"name": "John Doe"');
        });

        it('should export notebook to HTTP file format', () => {
            const notebookData = new mockVscode.NotebookData([
                new mockVscode.NotebookCellData(
                    mockVscode.NotebookCellKind.Markup,
                    '# API Testing\n\nThis tests the user management API.',
                    'markdown'
                ),
                new mockVscode.NotebookCellData(
                    mockVscode.NotebookCellKind.Code,
                    'GET https://api.example.com/users',
                    'http'
                ),
                new mockVscode.NotebookCellData(
                    mockVscode.NotebookCellKind.Code,
                    'console.log("Processing response...");',
                    'javascript'
                ),
                new mockVscode.NotebookCellData(
                    mockVscode.NotebookCellKind.Code,
                    'POST https://api.example.com/users\nContent-Type: application/json\n\n{"name": "Test User"}',
                    'http'
                ),
            ]);

            const httpContent = notebookProvider.exportToHttpFile(notebookData);

            expect(httpContent).toContain('### API Testing');
            expect(httpContent).toContain('This tests the user management API.');
            expect(httpContent).toContain('GET https://api.example.com/users');
            expect(httpContent).toContain('POST https://api.example.com/users');
            expect(httpContent).toContain('{"name": "Test User"}');
            
            // JavaScript cells should be commented out or excluded
            expect(httpContent).not.toContain('console.log') || expect(httpContent).toContain('# console.log');
        });
    });

    describe('Notebook Metadata', () => {
        it('should include Pathfinder-specific metadata', async () => {
            const notebookData = new mockVscode.NotebookData([]);
            const token = new vscode.CancellationToken();
            
            const serialized = await notebookProvider.serializeNotebook(notebookData, token);
            const parsedData = JSON.parse(serialized.toString());
            
            expect(parsedData.metadata.pathfinder).toBeDefined();
            expect(parsedData.metadata.pathfinder.version).toBeDefined();
            expect(parsedData.metadata.kernelspec).toEqual({
                display_name: 'Pathfinder HTTP',
                language: 'http',
                name: 'pathfinder-http'
            });
        });

        it('should preserve environment and schema information', async () => {
            const notebookData = new mockVscode.NotebookData([]);
            notebookData.metadata = {
                pathfinder: {
                    environment: 'production',
                    schema: 'user-api-v2',
                    variables: {
                        baseUrl: 'https://api.prod.example.com',
                        apiVersion: 'v2'
                    }
                }
            };

            const token = new vscode.CancellationToken();
            const serialized = await notebookProvider.serializeNotebook(notebookData, token);
            const parsedData = JSON.parse(serialized.toString());
            
            expect(parsedData.metadata.pathfinder.environment).toBe('production');
            expect(parsedData.metadata.pathfinder.schema).toBe('user-api-v2');
            expect(parsedData.metadata.pathfinder.variables.baseUrl).toBe('https://api.prod.example.com');
        });
    });

    describe('Error Handling', () => {
        it('should handle malformed JSON gracefully', async () => {
            const malformedJson = 'This is not valid JSON content';
            const uint8Array = new TextEncoder().encode(malformedJson);
            const token = new vscode.CancellationToken();
            
            await expect(notebookProvider.deserializeNotebook(uint8Array, token))
                .rejects.toThrow('Invalid notebook format');
        });

        it('should handle missing required fields in JSON', async () => {
            const incompleteJson = JSON.stringify({
                // Missing cells array
                metadata: {}
            });
            
            const uint8Array = new TextEncoder().encode(incompleteJson);
            const token = new vscode.CancellationToken();
            
            await expect(notebookProvider.deserializeNotebook(uint8Array, token))
                .rejects.toThrow('Invalid notebook format');
        });

        it('should handle cancellation during serialization', async () => {
            const notebookData = new mockVscode.NotebookData([
                new mockVscode.NotebookCellData(
                    mockVscode.NotebookCellKind.Code,
                    'GET https://api.example.com/large-dataset',
                    'http'
                ),
            ]);

            const cancelledToken = {
                isCancellationRequested: true,
                onCancellationRequested: jest.fn()
            } as any;

            await expect(notebookProvider.serializeNotebook(notebookData, cancelledToken))
                .rejects.toThrow('Operation was cancelled');
        });
    });
});
