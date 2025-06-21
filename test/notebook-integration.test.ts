/**
 * Simple integration test for notebook functionality
 * Tests the basic construction and usage of notebook components
 */

// Mock VS Code
const mockVscode = {
    NotebookCellKind: {
        Code: 2,
        Markup: 1
    },
    NotebookData: class {
        constructor(public cells: any[]) {}
    },
    NotebookCellData: class {
        constructor(public kind: number, public value: string, public languageId: string) {}
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
        })
    },
    Uri: {
        parse: jest.fn().mockReturnValue({ toString: () => 'test-uri' })
    },
    ViewColumn: { One: 1 },
    window: {
        showNotebookDocument: jest.fn()
    },
    NotebookCellOutput: class {
        constructor(public outputs: any[]) {}
    },
    NotebookCellOutputItem: {
        text: jest.fn().mockReturnValue({ mime: 'text/plain', data: 'test' })
    }
};

// Mock the vscode module
jest.mock('vscode', () => mockVscode, { virtual: true });

import { NotebookController } from '../src/notebook/notebook-controller';
import { NotebookProvider } from '../src/notebook/notebook-provider';
import { HttpRequestParser } from '../src/notebook/http-request-parser';
import { HttpRequestExecutor } from '../src/notebook/http-request-executor';

describe('Notebook Integration', () => {
    let notebookController: NotebookController;
    let notebookProvider: NotebookProvider;
    let httpParser: HttpRequestParser;
    let httpExecutor: HttpRequestExecutor;
    let mockContext: any;
    let mockConfigManager: any;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock context and config manager
        mockContext = {
            subscriptions: []
        };
          mockConfigManager = {
            getApiSchema: jest.fn(),
            getSchemaEnvironment: jest.fn(),
            getSchemaEnvironments: jest.fn().mockResolvedValue([])
        };
        
        // Create instances
        notebookProvider = new NotebookProvider();
        httpParser = new HttpRequestParser();
        httpExecutor = new HttpRequestExecutor(mockConfigManager);
        notebookController = new NotebookController(mockContext, mockConfigManager);
    });

    describe('Component Creation', () => {
        it('should create NotebookController successfully', () => {
            expect(notebookController).toBeDefined();
            expect(notebookController).toBeInstanceOf(NotebookController);
        });

        it('should create NotebookProvider successfully', () => {
            expect(notebookProvider).toBeDefined();
            expect(notebookProvider).toBeInstanceOf(NotebookProvider);
        });

        it('should create HttpRequestParser successfully', () => {
            expect(httpParser).toBeDefined();
            expect(httpParser).toBeInstanceOf(HttpRequestParser);
        });

        it('should create HttpRequestExecutor successfully', () => {
            expect(httpExecutor).toBeDefined();
            expect(httpExecutor).toBeInstanceOf(HttpRequestExecutor);
        });
    });

    describe('Basic Functionality', () => {
        it('should have required methods on NotebookController', () => {
            expect(typeof notebookController.createNotebookForEndpoint).toBe('function');
            expect(typeof notebookController.executeCells).toBe('function');
            expect(typeof notebookController.formatResponse).toBe('function');
            expect(typeof notebookController.extractVariables).toBe('function');
        });

        it('should have required methods on NotebookProvider', () => {
            expect(typeof notebookProvider.convertHttpFileToNotebook).toBe('function');
            expect(typeof notebookProvider.exportToHttpFile).toBe('function');
        });

        it('should parse simple HTTP request', () => {
            const httpText = 'GET https://api.example.com/users';
            
            const result = httpParser.parse(httpText);
            
            expect(result).toBeDefined();
            expect(result.method).toBe('GET');
            expect(result.url).toBe('https://api.example.com/users');
        });        it('should execute HTTP request', async () => {
            // Mock fetch
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Map([['content-type', 'application/json']]),
                text: jest.fn().mockResolvedValue('{"success": true}')
            });

            const request = {
                method: 'GET',
                url: 'https://api.example.com/test',
                headers: {}
            };

            const result = await httpExecutor.execute(request);

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.status).toBe(200);
        });
    });    describe('Notebook Creation for Endpoint', () => {
        it('should create notebook for basic endpoint', async () => {
            const endpoint = {
                path: '/users',
                method: 'GET',
                summary: 'Get all users'
            };            const environment = {
                id: 'test-env',
                name: 'Test Environment',
                baseUrl: 'https://api.example.com',
                schemaId: 'test-schema',
                auth: { type: 'none' as const },
                createdAt: new Date()
            };

            const result = await notebookController.createNotebookForEndpoint(endpoint, environment);

            expect(result).toBeDefined();
            // The exact structure will depend on our implementation
        });
    });

    describe('Error Handling', () => {
        it('should handle malformed HTTP requests gracefully', () => {
            const httpText = 'INVALID REQUEST';

            expect(() => {
                httpParser.parse(httpText);
            }).toThrow();
        });        it('should handle network errors in executor', async () => {
            // Mock fetch to reject
            global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

            const request = {
                method: 'GET',
                url: 'https://api.example.com/test',
                headers: {}
            };

            const result = await httpExecutor.execute(request);

            expect(result).toBeDefined();
            expect(result.success).toBe(false);
            expect(result.error).toContain('Network error');
        });
    });
});