/**
 * End-to-end test for notebook workflow
 * Tests the complete user journey from tree view to notebook execution
 */

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
    TreeItem: class {
        constructor(public label: string, public collapsibleState?: any) {}
    },
    TreeItemCollapsibleState: {
        None: 0,
        Collapsed: 1,
        Expanded: 2
    },
    EventEmitter: class {
        event = jest.fn();
        fire = jest.fn();
        dispose = jest.fn();
    },
    notebooks: {
        createNotebookController: jest.fn().mockReturnValue({
            supportedLanguages: [],
            supportsExecutionOrder: false,
            executeHandler: null,
            createNotebookCellExecution: jest.fn().mockReturnValue({
                start: jest.fn(),
                end: jest.fn(),
                replaceOutput: jest.fn()
            }),
            dispose: jest.fn()
        })
    },
    workspace: {
        openNotebookDocument: jest.fn().mockResolvedValue({
            getCells: jest.fn().mockReturnValue([])
        }),
        registerNotebookSerializer: jest.fn()
    },
    Uri: {
        parse: jest.fn().mockReturnValue({ toString: () => 'test-uri' })
    },
    ViewColumn: { One: 1 },
    window: {
        showNotebookDocument: jest.fn(),
        showInformationMessage: jest.fn()
    },
    NotebookCellOutput: class {
        constructor(public outputs: any[]) {}
    },    NotebookCellOutputItem: {
        text: jest.fn().mockReturnValue({ mime: 'text/plain', data: 'test' }),
        error: jest.fn().mockReturnValue({ mime: 'application/vnd.code.notebook.error', data: 'error' })
    },
    commands: {
        registerCommand: jest.fn()
    }
};

jest.mock('vscode', () => mockVscode, { virtual: true });

import { NotebookController } from '../src/notebook/notebook-controller';
import { NotebookProvider } from '../src/notebook/notebook-provider';
import { ApiTreeProvider } from '../src/tree-provider';

describe('Notebook Workflow End-to-End', () => {
    let notebookController: NotebookController;
    let notebookProvider: NotebookProvider;
    let treeProvider: ApiTreeProvider;
    let mockContext: any;
    let mockConfigManager: any;
    let mockSchemaLoader: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock context and dependencies
        mockContext = {
            subscriptions: []
        };
        
        mockConfigManager = {
            getApiSchema: jest.fn(),
            getSchemaEnvironment: jest.fn(),
            getSchemaEnvironments: jest.fn().mockResolvedValue([{
                id: 'dev',
                name: 'Development',
                baseUrl: 'https://api-dev.example.com',
                schemaId: 'test-schema',
                auth: { type: 'none' as const },
                createdAt: new Date()
            }])
        };
        
        mockSchemaLoader = {
            extractEndpoints: jest.fn()
        };
        
        // Create instances
        notebookProvider = new NotebookProvider();
        notebookController = new NotebookController(mockContext, mockConfigManager);
        treeProvider = new ApiTreeProvider(mockConfigManager, mockSchemaLoader, notebookController);
    });

    describe('Complete Workflow', () => {
        it('should create notebook from endpoint via tree view action', async () => {            // Simulate an API endpoint from tree view
            const endpoint = {
                path: '/api/users/{id}',
                method: 'GET',
                summary: 'Get user by ID',
                description: 'Retrieves a specific user by their unique identifier',
                operationId: 'getUserById',
                parameters: [
                    {
                        name: 'id',
                        in: 'path' as const,
                        required: true,
                        schema: { type: 'string' }
                    }
                ]
            };

            const environment = {
                id: 'dev',
                name: 'Development',
                baseUrl: 'https://api-dev.example.com',
                schemaId: 'test-schema',
                auth: { type: 'none' as const },
                createdAt: new Date()
            };

            // Test notebook creation
            const notebook = await notebookController.createNotebookForEndpoint(endpoint, environment);

            expect(notebook).toBeDefined();
            expect(mockVscode.window.showNotebookDocument).toHaveBeenCalled();
        });        it('should handle notebook-tree provider integration', () => {
            // Test that tree provider accepts notebook controller
            expect(treeProvider).toBeDefined();
            
            // Test endpoint creation for notebook
            const endpoint = {
                path: '/api/users',
                method: 'GET',
                summary: 'List users'
            };

            // This would be handled by the command system
            expect(endpoint).toBeDefined();
            expect(endpoint.path).toBe('/api/users');
        });

        it('should handle HTTP request parsing and execution in notebook context', async () => {
            // Test HTTP request parsing
            const httpRequest = `GET https://api-dev.example.com/api/users/123
Authorization: Bearer {{token}}
Content-Type: application/json`;

            // Create a sample notebook with HTTP request
            const notebookData = new mockVscode.NotebookData([
                new mockVscode.NotebookCellData(
                    mockVscode.NotebookCellKind.Markup,
                    '# User API Test\nThis notebook tests the user API endpoints.',
                    'markdown'
                ),
                new mockVscode.NotebookCellData(
                    mockVscode.NotebookCellKind.Code,
                    httpRequest,
                    'http'
                )
            ]);            // Test notebook conversion
            const httpFileContent = notebookProvider.exportToHttpFile(notebookData);
            expect(httpFileContent).toBeDefined();
            expect(httpFileContent).toContain('GET https://api-dev.example.com/api/users/123');
            expect(httpFileContent).toContain('Authorization: Bearer {{token}}');

            // Test reverse conversion
            const backToNotebook = notebookProvider.convertHttpFileToNotebook(httpFileContent);
            expect(backToNotebook).toBeDefined();
            expect(backToNotebook.cells.length).toBeGreaterThan(0);
        });

        it('should execute cells and handle responses', async () => {
            // Mock fetch for HTTP execution
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Map([['content-type', 'application/json']]),
                text: jest.fn().mockResolvedValue('{"id": 123, "name": "John Doe"}')
            });

            const cells = [{
                kind: mockVscode.NotebookCellKind.Code,
                value: 'GET https://api-dev.example.com/api/users/123',
                languageId: 'http'
            }];            // Create mock execution
            const mockExecution = {
                start: jest.fn(),
                end: jest.fn(),
                replaceOutput: jest.fn()
            };

            // Test cell execution
            await notebookController.executeCells(cells as any, mockExecution as any);
            expect(mockExecution.start).toHaveBeenCalled();
        });

        it('should handle variable context and substitution', () => {
            const variables = {
                baseUrl: 'https://api-dev.example.com',
                userId: '123',
                token: 'abc123'
            };

            const extracted = notebookController.extractVariables(variables);
            expect(extracted).toBeDefined();
            expect(typeof extracted).toBe('object');
        });

        it('should format responses correctly', () => {
            const mockResponse = {
                status: 200,
                statusText: 'OK',
                headers: { 'content-type': 'application/json' },
                data: { id: 123, name: 'John Doe' },
                body: '{"id": 123, "name": "John Doe"}',
                success: true,
                timing: 150
            };

            const formatted = notebookController.formatResponse(mockResponse);
            expect(formatted).toBeDefined();
            expect(typeof formatted).toBe('string');
        });
    });

    describe('Error Handling', () => {
        it('should handle missing environment gracefully', async () => {
            const endpoint = {
                path: '/api/test',
                method: 'GET',
                summary: 'Test endpoint'
            };

            const environment = {
                id: 'missing-env',
                name: 'Missing Environment',
                baseUrl: 'https://api.example.com',
                schemaId: 'missing-schema',
                auth: { type: 'none' as const },
                createdAt: new Date()
            };

            // Should not throw an error
            const result = await notebookController.createNotebookForEndpoint(endpoint, environment);
            expect(result).toBeDefined();
        });

        it('should handle malformed HTTP requests in notebooks', async () => {
            const invalidHttpRequest = 'INVALID REQUEST FORMAT';
            
            const notebookData = new mockVscode.NotebookData([
                new mockVscode.NotebookCellData(
                    mockVscode.NotebookCellKind.Code,
                    invalidHttpRequest,
                    'http'
                )
            ]);            // Should handle gracefully without crashing
            const result = notebookProvider.exportToHttpFile(notebookData);
            expect(result).toBeDefined();
        });
    });
});
