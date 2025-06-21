import * as vscode from 'vscode';
import { NotebookController } from '../../src/notebook/notebook-controller';
import { ConfigurationManager } from '../../src/configuration';
import { EndpointInfo } from '../../src/types';

// Mock VS Code APIs
const mockVscode = {
    notebooks: {
        createNotebookController: jest.fn(),
        createNotebookDocument: jest.fn(),
    },
    window: {
        showTextDocument: jest.fn(),
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn(),
    },
    workspace: {
        openNotebookDocument: jest.fn(),
    },
    ViewColumn: {
        One: 1,
        Two: 2,
    },
    NotebookCellKind: {
        Markup: 1,
        Code: 2,
    },
    Uri: {
        parse: jest.fn((str: string) => ({ toString: () => str })),
    },
};

jest.mock('vscode', () => mockVscode, { virtual: true });

describe('NotebookController', () => {
    let notebookController: NotebookController;
    let mockConfigManager: jest.Mocked<ConfigurationManager>;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockConfigManager = {
            getSchemaEnvironments: jest.fn(),
            getCredentials: jest.fn(),
        } as any;
        
        mockContext = {
            subscriptions: [],
            extensionUri: vscode.Uri.parse('file:///test'),
        } as any;

        notebookController = new NotebookController(mockContext, mockConfigManager);
    });

    describe('Notebook Registration', () => {
        it('should register pathfinder-http notebook controller', () => {
            expect(mockVscode.notebooks.createNotebookController).toHaveBeenCalledWith(
                'pathfinder-http-controller',
                'pathfinder-http-notebook',
                'Pathfinder HTTP Requests'
            );
        });

        it('should set controller properties correctly', () => {
            const mockController = {
                supportedLanguages: [],
                executeHandler: null,
                description: '',
            };
            mockVscode.notebooks.createNotebookController.mockReturnValue(mockController);
            
            new NotebookController(mockContext, mockConfigManager);
            
            expect(mockController.supportedLanguages).toEqual(['markdown', 'http', 'javascript']);
            expect(mockController.description).toBe('Execute HTTP requests and view responses inline');
            expect(mockController.executeHandler).toBeDefined();
        });
    });

    describe('Notebook Creation', () => {
        it('should create notebook for endpoint with authentication', async () => {
            const endpoint: EndpointInfo = {
                path: '/users/{id}',
                method: 'GET',
                summary: 'Get user by ID',
                description: 'Retrieve a specific user by their ID',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
            };

            const environment = {
                id: 'dev-env',
                name: 'Development',
                baseUrl: 'https://api.dev.example.com',
                auth: { type: 'bearer' },
                authSecretKey: 'secret-key-123',
            };

            mockConfigManager.getCredentials.mockResolvedValue({
                apiKey: 'test-bearer-token'
            });

            const result = await notebookController.createNotebookForEndpoint(endpoint, environment);

            expect(result).toBeDefined();
            expect(result.cells).toHaveLength(3); // markdown, http request, response cell
        });

        it('should create notebook with proper cell structure', async () => {
            const endpoint: EndpointInfo = {
                path: '/posts',
                method: 'POST',
                summary: 'Create a new post',
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    title: { type: 'string' },
                                    content: { type: 'string' }
                                }
                            }
                        }
                    }
                }
            };

            const environment = {
                id: 'prod-env',
                name: 'Production',
                baseUrl: 'https://api.example.com',
                auth: { type: 'none' },
            };

            const result = await notebookController.createNotebookForEndpoint(endpoint, environment);

            // First cell should be markdown with endpoint documentation
            expect(result.cells[0].kind).toBe(vscode.NotebookCellKind.Markup);
            expect(result.cells[0].value).toContain('Create a new post');
            expect(result.cells[0].value).toContain('POST /posts');

            // Second cell should be HTTP request
            expect(result.cells[1].kind).toBe(vscode.NotebookCellKind.Code);
            expect(result.cells[1].languageId).toBe('http');
            expect(result.cells[1].value).toContain('POST https://api.example.com/posts');
            expect(result.cells[1].value).toContain('Content-Type: application/json');
        });

        it('should include authentication headers in HTTP request cell', async () => {
            const endpoint: EndpointInfo = {
                path: '/protected',
                method: 'GET',
            };

            const environment = {
                id: 'auth-env',
                name: 'Authenticated Environment',
                baseUrl: 'https://api.example.com',
                auth: { type: 'apikey', apiKeyName: 'X-API-Key', apiKeyLocation: 'header' },
                authSecretKey: 'secret-key-456',
            };

            mockConfigManager.getCredentials.mockResolvedValue({
                apiKey: 'my-secret-api-key'
            });

            const result = await notebookController.createNotebookForEndpoint(endpoint, environment);

            const httpCell = result.cells.find(cell => cell.languageId === 'http');
            expect(httpCell?.value).toContain('X-API-Key: my-secret-api-key');
        });

        it('should handle request body templates correctly', async () => {
            const endpoint: EndpointInfo = {
                path: '/users',
                method: 'POST',
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string', example: 'John Doe' },
                                    email: { type: 'string', format: 'email' },
                                    age: { type: 'integer', minimum: 0 }
                                },
                                required: ['name', 'email']
                            }
                        }
                    }
                }
            };

            const environment = {
                id: 'test-env',
                name: 'Test',
                baseUrl: 'https://api.test.com',
                auth: { type: 'none' },
            };

            const result = await notebookController.createNotebookForEndpoint(endpoint, environment);

            const httpCell = result.cells.find(cell => cell.languageId === 'http');
            expect(httpCell?.value).toContain('"name": "John Doe"');
            expect(httpCell?.value).toContain('"email":');
            expect(httpCell?.value).toContain('"age":');
        });
    });

    describe('Cell Execution', () => {
        it('should execute HTTP request cell and return response', async () => {
            const mockCell = {
                kind: vscode.NotebookCellKind.Code,
                languageId: 'http',
                value: 'GET https://api.example.com/users\nAuthorization: Bearer token123',
                metadata: {},
            };

            const mockExecution = {
                replaceOutput: jest.fn(),
                start: jest.fn(),
                end: jest.fn(),
            };

            // Mock fetch response
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Map([['content-type', 'application/json']]),
                json: async () => ({ users: [{ id: 1, name: 'John' }] }),
                text: async () => '{"users":[{"id":1,"name":"John"}]}',
            });

            await notebookController.executeCells([mockCell], mockExecution);

            expect(mockExecution.start).toHaveBeenCalled();
            expect(mockExecution.replaceOutput).toHaveBeenCalled();
            expect(mockExecution.end).toHaveBeenCalledWith(true);

            const outputCall = mockExecution.replaceOutput.mock.calls[0][0];
            expect(outputCall).toHaveLength(1);
            expect(outputCall[0].items).toBeDefined();
        });

        it('should handle HTTP request errors gracefully', async () => {
            const mockCell = {
                kind: vscode.NotebookCellKind.Code,
                languageId: 'http',
                value: 'GET https://api.example.com/nonexistent',
                metadata: {},
            };

            const mockExecution = {
                replaceOutput: jest.fn(),
                start: jest.fn(),
                end: jest.fn(),
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                headers: new Map([['content-type', 'application/json']]),
                text: async () => '{"error":"Resource not found"}',
            });

            await notebookController.executeCells([mockCell], mockExecution);

            expect(mockExecution.end).toHaveBeenCalledWith(true);
            
            const outputCall = mockExecution.replaceOutput.mock.calls[0][0];
            const outputText = outputCall[0].items[0].data.toString();
            expect(outputText).toContain('404');
            expect(outputText).toContain('Not Found');
        });

        it('should execute JavaScript cells in notebook context', async () => {
            const mockCell = {
                kind: vscode.NotebookCellKind.Code,
                languageId: 'javascript',
                value: 'const result = JSON.parse(response).users.length;\nconsole.log(`Found ${result} users`);',
                metadata: {},
            };

            const mockExecution = {
                replaceOutput: jest.fn(),
                start: jest.fn(),
                end: jest.fn(),
            };

            // Mock notebook context with previous response
            const notebookContext = {
                response: '{"users":[{"id":1,"name":"John"},{"id":2,"name":"Jane"}]}',
                variables: new Map(),
            };

            await notebookController.executeCells([mockCell], mockExecution, notebookContext);

            expect(mockExecution.replaceOutput).toHaveBeenCalled();
            
            const outputCall = mockExecution.replaceOutput.mock.calls[0][0];
            const outputText = outputCall[0].items[0].data.toString();
            expect(outputText).toContain('Found 2 users');
        });

        it('should skip execution of markdown cells', async () => {
            const mockCell = {
                kind: vscode.NotebookCellKind.Markup,
                languageId: 'markdown',
                value: '# This is documentation',
                metadata: {},
            };

            const mockExecution = {
                replaceOutput: jest.fn(),
                start: jest.fn(),
                end: jest.fn(),
            };

            await notebookController.executeCells([mockCell], mockExecution);

            expect(mockExecution.start).toHaveBeenCalled();
            expect(mockExecution.end).toHaveBeenCalledWith(true);
            expect(mockExecution.replaceOutput).not.toHaveBeenCalled();
        });
    });

    describe('Response Formatting', () => {
        it('should format JSON responses with syntax highlighting', () => {
            const response = {
                status: 200,
                headers: { 'content-type': 'application/json' },
                body: '{"message":"success","data":{"id":123}}',
            };

            const formatted = notebookController.formatResponse(response);

            expect(formatted.mimeType).toBe('application/json');
            expect(formatted.content).toContain('"message": "success"');
            expect(formatted.content).toContain('"id": 123');
        });

        it('should format HTML responses appropriately', () => {
            const response = {
                status: 200,
                headers: { 'content-type': 'text/html' },
                body: '<html><body><h1>Hello World</h1></body></html>',
            };

            const formatted = notebookController.formatResponse(response);

            expect(formatted.mimeType).toBe('text/html');
            expect(formatted.content).toContain('<h1>Hello World</h1>');
        });

        it('should include response metadata (status, headers, timing)', () => {
            const response = {
                status: 201,
                statusText: 'Created',
                headers: { 
                    'content-type': 'application/json',
                    'x-rate-limit': '100'
                },
                body: '{"id":456}',
                timing: 250,
            };

            const formatted = notebookController.formatResponse(response);

            expect(formatted.metadata).toEqual({
                status: 201,
                statusText: 'Created',
                timing: 250,
                headers: {
                    'content-type': 'application/json',
                    'x-rate-limit': '100'
                }
            });
        });
    });

    describe('Variable Context', () => {
        it('should extract variables from HTTP responses', () => {
            const response = {
                status: 200,
                body: '{"token":"abc123","userId":789}',
            };

            const variables = notebookController.extractVariables(response);

            expect(variables.get('token')).toBe('abc123');
            expect(variables.get('userId')).toBe(789);
        });

        it('should make variables available to subsequent cells', async () => {
            // First cell - HTTP request that sets variables
            const httpCell = {
                kind: vscode.NotebookCellKind.Code,
                languageId: 'http',
                value: 'POST https://api.example.com/auth',
                metadata: {},
            };

            // Second cell - JavaScript that uses variables
            const jsCell = {
                kind: vscode.NotebookCellKind.Code,
                languageId: 'javascript',
                value: 'console.log("Auth token:", token);',
                metadata: {},
            };

            const mockExecution = {
                replaceOutput: jest.fn(),
                start: jest.fn(),
                end: jest.fn(),
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ token: 'test-token-123' }),
                text: async () => '{"token":"test-token-123"}',
                headers: new Map([['content-type', 'application/json']]),
            });

            // Execute HTTP cell first
            await notebookController.executeCells([httpCell], mockExecution);
            
            // Execute JavaScript cell - should have access to token variable
            await notebookController.executeCells([jsCell], mockExecution);

            expect(mockExecution.replaceOutput).toHaveBeenCalledTimes(2);
            
            const jsOutput = mockExecution.replaceOutput.mock.calls[1][0];
            const jsOutputText = jsOutput[0].items[0].data.toString();
            expect(jsOutputText).toContain('test-token-123');
        });
    });

    describe('Integration with Tree Provider', () => {
        it('should add "Run in Request Notebook" action to tree items', () => {
            // This test would verify that the tree provider includes the new action
            // We'll implement this when we modify the tree provider
            expect(true).toBe(true); // Placeholder
        });
    });

    describe('Error Handling', () => {
        it('should handle malformed HTTP requests gracefully', async () => {
            const mockCell = {
                kind: vscode.NotebookCellKind.Code,
                languageId: 'http',
                value: 'INVALID REQUEST FORMAT',
                metadata: {},
            };

            const mockExecution = {
                replaceOutput: jest.fn(),
                start: jest.fn(),
                end: jest.fn(),
            };

            await notebookController.executeCells([mockCell], mockExecution);

            expect(mockExecution.end).toHaveBeenCalledWith(false);
            
            const outputCall = mockExecution.replaceOutput.mock.calls[0][0];
            expect(outputCall[0].items[0].data.toString()).toContain('Error parsing HTTP request');
        });

        it('should handle network errors appropriately', async () => {
            const mockCell = {
                kind: vscode.NotebookCellKind.Code,
                languageId: 'http',
                value: 'GET https://nonexistent.example.com/api',
                metadata: {},
            };

            const mockExecution = {
                replaceOutput: jest.fn(),
                start: jest.fn(),
                end: jest.fn(),
            };

            global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

            await notebookController.executeCells([mockCell], mockExecution);

            expect(mockExecution.end).toHaveBeenCalledWith(false);
            
            const outputCall = mockExecution.replaceOutput.mock.calls[0][0];
            expect(outputCall[0].items[0].data.toString()).toContain('Network error');
        });
    });
});
