/**
 * Simple integration test for notebook functionality
 * Tests the basic construction and usage of notebook components
 */

import { NotebookController } from '../src/notebook/notebook-controller';
import { NotebookProvider } from '../src/notebook/notebook-provider';
import { HttpRequestParser } from '../src/notebook/http-request-parser';
import { HttpRequestExecutor } from '../src/notebook/http-request-executor';

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
        json: jest.fn().mockReturnValue({ mimeType: 'application/json' }),
        text: jest.fn().mockReturnValue({ mimeType: 'text/plain' }),
        error: jest.fn().mockReturnValue({ mimeType: 'application/vnd.code.notebook.error' })
    }
};

jest.mock('vscode', () => mockVscode, { virtual: true });

describe('Notebook Integration Test', () => {
    let mockConfigManager: any;
    let mockContext: any;

    beforeEach(() => {
        mockConfigManager = {
            getSchemaEnvironments: jest.fn().mockResolvedValue([
                { id: 'test-env', name: 'Test Environment', baseUrl: 'https://api.test.com' }
            ])
        };

        mockContext = {
            subscriptions: []
        };

        // Reset mocks
        jest.clearAllMocks();
    });    describe('Component Construction', () => {
        it('should create NotebookController without errors', () => {
            expect(() => {
                const controller = new NotebookController(mockContext, mockConfigManager);
                expect(controller).toBeDefined();
            }).not.toThrow();
        });

        it('should create NotebookProvider without errors', () => {
            expect(() => {
                const provider = new NotebookProvider();
                expect(provider).toBeDefined();
            }).not.toThrow();
        });

        it('should create HttpRequestParser without errors', () => {
            expect(() => {
                const parser = new HttpRequestParser();
                expect(parser).toBeDefined();
            }).not.toThrow();
        });

        it('should create HttpRequestExecutor without errors', () => {
            expect(() => {
                const executor = new HttpRequestExecutor(mockConfigManager);
                expect(executor).toBeDefined();
            }).not.toThrow();
        });
    });

    describe('Basic Functionality', () => {
        it('should parse simple HTTP requests', () => {
            const parser = new HttpRequestParser();
            const httpText = 'GET https://api.example.com/users';
            
            expect(() => {
                parser.parse(httpText);
            }).not.toThrow();
        });

        it('should create notebook data from text', () => {
            const provider = new NotebookProvider();
            const content = 'GET https://api.example.com/users\nContent-Type: application/json';
            
            expect(() => {
                provider.convertTextToNotebook(content);
            }).not.toThrow();
        });

        it('should handle HTTP file conversion', () => {
            const provider = new NotebookProvider();
            const httpContent = 'GET https://api.example.com/users\nAuthorization: Bearer token123';
            
            expect(() => {
                provider.convertHttpFileToNotebook(httpContent);
            }).not.toThrow();
        });
    });

    describe('Method Availability', () => {
        it('should have required methods on NotebookController', () => {
            const controller = new NotebookController(mockContext, mockConfigManager);
            
            expect(typeof controller.createNotebookFromEndpoint).toBe('function');
            expect(typeof controller.createNotebookForEndpoint).toBe('function');
            expect(typeof controller.executeCells).toBe('function');
            expect(typeof controller.formatResponse).toBe('function');
            expect(typeof controller.extractVariables).toBe('function');
            expect(typeof controller.getVariableContext).toBe('function');
            expect(typeof controller.setVariable).toBe('function');
        });

        it('should have required methods on NotebookProvider', () => {
            const provider = new NotebookProvider();
            
            expect(typeof provider.deserializeNotebook).toBe('function');
            expect(typeof provider.serializeNotebook).toBe('function');
            expect(typeof provider.convertTextToNotebook).toBe('function');
            expect(typeof provider.convertHttpFileToNotebook).toBe('function');
            expect(typeof provider.exportToHttpFile).toBe('function');
        });

        it('should have required methods on HttpRequestParser', () => {
            const parser = new HttpRequestParser();
            
            expect(typeof parser.parse).toBe('function');
            expect(typeof parser.parseHttpRequest).toBe('function');
        });

        it('should have required methods on HttpRequestExecutor', () => {
            const executor = new HttpRequestExecutor(mockConfigManager);
            
            expect(typeof executor.execute).toBe('function');
            expect(typeof executor.executeRequest).toBe('function');
        });
    });

    describe('Variable Context', () => {
        it('should manage variable context correctly', () => {
            const controller = new NotebookController(mockContext, mockConfigManager);
            
            // Test setting and getting variables
            controller.setVariable('testKey', 'testValue');
            const context = controller.getVariableContext();
            
            expect(context.testKey).toBe('testValue');
        });

        it('should extract variables from responses', () => {
            const controller = new NotebookController(mockContext, mockConfigManager);
            
            const response = {
                id: 123,
                token: 'abc123',
                access_token: 'def456',
                data: { key: 'value' }
            };
            
            const variables = controller.extractVariables(response);
            
            expect(variables.lastId).toBe(123);
            expect(variables.authToken).toBe('abc123');
            expect(variables.accessToken).toBe('def456');
            expect(variables.lastData).toEqual({ key: 'value' });
        });
    });

    describe('Response Formatting', () => {
        it('should format JSON responses correctly', () => {
            const controller = new NotebookController(mockContext, mockConfigManager);
            
            const response = { message: 'success', data: [1, 2, 3] };
            const formatted = controller.formatResponse(response);
            
            expect(typeof formatted).toBe('string');
            expect(formatted).toContain('message');
            expect(formatted).toContain('success');
        });

        it('should format string responses correctly', () => {
            const controller = new NotebookController(mockContext, mockConfigManager);
            
            const response = '{"test": true}';
            const formatted = controller.formatResponse(response);
            
            expect(typeof formatted).toBe('string');
        });
    });
});
