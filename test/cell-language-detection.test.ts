/**
 * Test for the new cell language detection and error handling functionality
 */

import { NotebookController } from '../src/notebook/notebook-controller';
import { ConfigurationManager } from '../src/configuration';
import * as vscode from 'vscode';

// Mock VS Code module (use inline function to avoid hoisting issues)
jest.mock('vscode', () => ({
    notebooks: {
        createNotebookController: jest.fn(),
    },
    NotebookCellOutput: jest.fn(),
    NotebookCellOutputItem: {
        text: jest.fn(),
        error: jest.fn(),
        json: jest.fn(),
    },
    NotebookCellKind: {
        Markup: 1,
        Code: 2,
    },
    NotebookData: jest.fn(),
    workspace: {
        openNotebookDocument: jest.fn(),
    },
    window: {
        showNotebookDocument: jest.fn(),
    },
    Uri: {
        parse: jest.fn((str: string) => ({ toString: () => str })),
    },
}), { virtual: true });

describe('Notebook Cell Language Detection and Error Handling', () => {
    let notebookController: NotebookController;
    let mockConfigManager: jest.Mocked<ConfigurationManager>;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockConfigManager = {
            getSchemaEnvironments: jest.fn().mockResolvedValue([]),
            getSchemaEnvironment: jest.fn().mockResolvedValue(null),
        } as any;
        
        mockContext = {
            subscriptions: [],
        } as any;        // Mock the controller creation
        const mockController = {
            supportedLanguages: [],
            supportsExecutionOrder: false,
            executeHandler: undefined,
            createNotebookCellExecution: jest.fn()
        };
        
        (vscode.notebooks.createNotebookController as jest.Mock).mockReturnValue(mockController as any);
        
        notebookController = new NotebookController(mockContext, mockConfigManager);
    });

    describe('Content Detection', () => {
        test('should detect HTTP content correctly', () => {
            // Use private method via bracket notation for testing
            const controller = notebookController as any;
            
            expect(controller.detectHttpContent('GET /api/users')).toBe(true);
            expect(controller.detectHttpContent('POST /api/users\nContent-Type: application/json')).toBe(true);
            expect(controller.detectHttpContent('DELETE /api/users/123')).toBe(true);
            expect(controller.detectHttpContent('PUT /api/users/123')).toBe(true);
            expect(controller.detectHttpContent('PATCH /api/users/123')).toBe(true);
            expect(controller.detectHttpContent('OPTIONS /api/users')).toBe(true);
            expect(controller.detectHttpContent('HEAD /api/users')).toBe(true);
            
            // Should not detect HTTP in non-HTTP content
            expect(controller.detectHttpContent('This is just plain text')).toBe(false);
            expect(controller.detectHttpContent('{"name": "test"}')).toBe(false);
            expect(controller.detectHttpContent('')).toBe(false);
            expect(controller.detectHttpContent('# This is a heading')).toBe(false);
        });

        test('should detect JSON content correctly', () => {
            const controller = notebookController as any;
            
            expect(controller.detectJsonContent('{"name": "test"}')).toBe(true);
            expect(controller.detectJsonContent('[1, 2, 3]')).toBe(true);
            expect(controller.detectJsonContent('{"users": [{"id": 1, "name": "John"}]}')).toBe(true);
            expect(controller.detectJsonContent('null')).toBe(true);
            expect(controller.detectJsonContent('true')).toBe(true);
            expect(controller.detectJsonContent('123')).toBe(true);
            
            // Should not detect JSON in non-JSON content
            expect(controller.detectJsonContent('invalid json')).toBe(false);
            expect(controller.detectJsonContent('GET /api/users')).toBe(false);
            expect(controller.detectJsonContent('')).toBe(false);
            expect(controller.detectJsonContent('# This is a heading')).toBe(false);
        });

        test('should detect Markdown content correctly', () => {
            const controller = notebookController as any;
            
            expect(controller.detectMarkdownContent('# This is a heading')).toBe(true);
            expect(controller.detectMarkdownContent('## Secondary heading')).toBe(true);
            expect(controller.detectMarkdownContent('**This is bold**')).toBe(true);
            expect(controller.detectMarkdownContent('*This is italic*')).toBe(true);
            expect(controller.detectMarkdownContent('[Link text](http://example.com)')).toBe(true);
            expect(controller.detectMarkdownContent('> This is a blockquote')).toBe(true);
            expect(controller.detectMarkdownContent('- This is a list item')).toBe(true);
            expect(controller.detectMarkdownContent('1. This is a numbered list')).toBe(true);
            expect(controller.detectMarkdownContent('```javascript\nconsole.log("hello");\n```')).toBe(true);
            
            // Should not detect Markdown in non-Markdown content
            expect(controller.detectMarkdownContent('This is just plain text')).toBe(false);
            expect(controller.detectMarkdownContent('GET /api/users')).toBe(false);
            expect(controller.detectMarkdownContent('{"name": "test"}')).toBe(false);
            expect(controller.detectMarkdownContent('')).toBe(false);
        });
    });

    describe('Cell Language Support Detection', () => {
        test('should correctly identify supported cell languages', () => {
            const controller = notebookController as any;
            
            const httpCell = { document: { languageId: 'http' } } as any;
            const jsonCell = { document: { languageId: 'json' } } as any;
            const markdownCell = { document: { languageId: 'markdown' } } as any;
            const pythonCell = { document: { languageId: 'python' } } as any;
            const javascriptCell = { document: { languageId: 'javascript' } } as any;
            
            expect(controller.isCellSupportedByController(httpCell)).toBe(true);
            expect(controller.isCellSupportedByController(jsonCell)).toBe(true);
            expect(controller.isCellSupportedByController(markdownCell)).toBe(true);
            expect(controller.isCellSupportedByController(pythonCell)).toBe(false);
            expect(controller.isCellSupportedByController(javascriptCell)).toBe(false);
        });
    });    describe('Error Handling Integration', () => {
        test('should handle unsupported cell languages with helpful messages', async () => {
            const controller = notebookController as any;
            
            // Mock cell execution
            const mockExecution = {
                start: jest.fn(),
                end: jest.fn(),
                replaceOutput: jest.fn()
            };
            
            // Mock VS Code output creation
            (vscode.NotebookCellOutput as jest.Mock).mockImplementation((items) => ({ items }));
            (vscode.NotebookCellOutputItem.text as jest.Mock).mockImplementation((text, mimeType) => ({ 
                data: text, 
                mime: mimeType 
            }));
            
            // Mock a Python cell with HTTP content
            const httpContentPythonCell = {
                document: {
                    languageId: 'python',
                    getText: () => 'GET /api/users'
                }
            } as any;
            
            await controller.handleUnsupportedCell(httpContentPythonCell, mockExecution);
            
            expect(mockExecution.replaceOutput).toHaveBeenCalled();
            const outputCall = mockExecution.replaceOutput.mock.calls[0][0];
            const outputText = outputCall[0].items[0].data;
            
            // Should contain helpful guidance
            expect(outputText).toContain('Cell Language Issue');
            expect(outputText).toContain('Detected HTTP Content');
            expect(outputText).toContain("Change the cell language to 'http'");
            expect(outputText).toContain('language selector');
            
            expect(mockExecution.end).toHaveBeenCalledWith(false, expect.any(Number));
        });

        test('should provide general guidance for unsupported languages without detected content', async () => {
            const controller = notebookController as any;
            
            const mockExecution = {
                start: jest.fn(),
                end: jest.fn(),
                replaceOutput: jest.fn()
            };
            
            // Mock VS Code output creation
            (vscode.NotebookCellOutput as jest.Mock).mockImplementation((items) => ({ items }));
            (vscode.NotebookCellOutputItem.text as jest.Mock).mockImplementation((text, mimeType) => ({ 
                data: text, 
                mime: mimeType 
            }));
            
            // Mock a Python cell with plain text
            const plainTextPythonCell = {
                document: {
                    languageId: 'python',
                    getText: () => 'This is just plain text'
                }
            } as any;
            
            await controller.handleUnsupportedCell(plainTextPythonCell, mockExecution);
            
            expect(mockExecution.replaceOutput).toHaveBeenCalled();
            const outputCall = mockExecution.replaceOutput.mock.calls[0][0];
            const outputText = outputCall[0].items[0].data;
            
            // Should contain general guidance
            expect(outputText).toContain('Cell Language Issue');
            expect(outputText).toContain('For HTTP requests: Change cell language to');
            expect(outputText).toContain('For variables/JSON data: Change cell language to');
            expect(outputText).toContain('For documentation: Change cell language to');
        });
    });
});
