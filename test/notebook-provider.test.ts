/**
 * Test suite for NotebookProvider functionality
 * Focuses on XML serialization and HTTP file conversion
 */

// Mock VS Code APIs first
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

import { NotebookProvider } from '../src/notebook/notebook-provider';

describe('NotebookProvider', () => {
    let notebookProvider: NotebookProvider;

    beforeEach(() => {
        jest.clearAllMocks();
        notebookProvider = new NotebookProvider();
    });

    describe('Basic Functionality', () => {
        it('should create NotebookProvider successfully', () => {
            expect(notebookProvider).toBeDefined();
            expect(notebookProvider).toBeInstanceOf(NotebookProvider);
        });

        it('should have required methods', () => {
            expect(typeof notebookProvider.convertHttpFileToNotebook).toBe('function');
            expect(typeof notebookProvider.exportToHttpFile).toBe('function');
        });
    });

    describe('HTTP File Conversion', () => {
        it('should convert simple HTTP request to notebook', async () => {
            const httpContent = 'GET https://api.example.com/users';

            const result = await notebookProvider.convertHttpFileToNotebook(httpContent);

            expect(result).toBeDefined();
            expect(result.cells.length).toBeGreaterThan(0);
        });

        it('should export notebook to HTTP file format', async () => {
            const notebookData = new mockVscode.NotebookData([
                new mockVscode.NotebookCellData(
                    mockVscode.NotebookCellKind.Code,
                    'GET https://api.example.com/users',
                    'http'
                ),
            ]);

            const result = await notebookProvider.exportToHttpFile(notebookData);

            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
        });
    });
});