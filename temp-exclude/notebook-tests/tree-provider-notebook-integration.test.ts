import * as vscode from 'vscode';
import { ApiTreeProvider } from '../../src/tree-provider';
import { NotebookController } from '../../src/notebook/notebook-controller';
import { ConfigurationManager } from '../../src/configuration';
import { EndpointInfo } from '../../src/types';

// Mock VS Code APIs
const mockVscode = {
    TreeItem: class {
        constructor(public label: string, public collapsibleState?: number) {}
        command?: vscode.Command;
        contextValue?: string;
    },
    TreeItemCollapsibleState: {
        None: 0,
        Collapsed: 1,
        Expanded: 2,
    },
    commands: {
        registerCommand: jest.fn(),
    },
};

jest.mock('vscode', () => mockVscode, { virtual: true });

describe('Tree Provider Notebook Integration', () => {
    let treeProvider: ApiTreeProvider;
    let notebookController: NotebookController;
    let mockConfigManager: jest.Mocked<ConfigurationManager>;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockConfigManager = {
            getApiSchemas: jest.fn().mockReturnValue([]),
            getSchemaEnvironments: jest.fn().mockReturnValue([]),
            getSchemaEnvironmentGroups: jest.fn().mockReturnValue([]),
        } as any;
        
        mockContext = {
            subscriptions: [],
            extensionUri: vscode.Uri.parse('file:///test'),
        } as any;

        notebookController = new NotebookController(mockContext, mockConfigManager);
        treeProvider = new ApiTreeProvider(mockConfigManager, mockContext, notebookController);
    });

    describe('Tree Item Commands', () => {
        it('should add "Run in Request Notebook" command to endpoint tree items', async () => {
            const endpoint: EndpointInfo = {
                path: '/users/{id}',
                method: 'GET',
                summary: 'Get user by ID',
                operationId: 'getUserById',
            };

            const treeItem = await treeProvider.createEndpointTreeItem(endpoint, 'test-schema');

            expect(treeItem.contextValue).toContain('endpoint');
            
            // Should register the notebook command
            expect(mockVscode.commands.registerCommand).toHaveBeenCalledWith(
                'pathfinder.runInNotebook',
                expect.any(Function)
            );
        });

        it('should create notebook when "Run in Request Notebook" is executed', async () => {
            const endpoint: EndpointInfo = {
                path: '/posts',
                method: 'POST',
                summary: 'Create a post',
                operationId: 'createPost',
            };

            const environment = {
                id: 'dev',
                name: 'Development',
                baseUrl: 'https://api.dev.example.com',
                auth: { type: 'none' },
            };

            mockConfigManager.getSchemaEnvironments.mockReturnValue([environment]);

            // Mock the notebook creation
            const mockNotebook = {
                uri: vscode.Uri.parse('untitled:PathfinderRequest.pathfinder-nb'),
                cells: [
                    { kind: vscode.NotebookCellKind.Markup, value: '# Create a post' },
                    { kind: vscode.NotebookCellKind.Code, value: 'POST https://api.dev.example.com/posts' },
                ],
            };

            jest.spyOn(notebookController, 'createNotebookForEndpoint')
                .mockResolvedValue(mockNotebook as any);

            jest.spyOn(vscode.window, 'showQuickPick')
                .mockResolvedValue(environment as any);

            // Execute the command
            const commandHandler = mockVscode.commands.registerCommand.mock.calls
                .find(call => call[0] === 'pathfinder.runInNotebook')?.[1];

            expect(commandHandler).toBeDefined();
            await commandHandler(endpoint, 'test-schema');

            expect(notebookController.createNotebookForEndpoint).toHaveBeenCalledWith(
                endpoint,
                environment,
                'test-schema'
            );
        });

        it('should show environment picker when multiple environments exist', async () => {
            const endpoint: EndpointInfo = {
                path: '/api/data',
                method: 'GET',
                operationId: 'getData',
            };

            const environments = [
                { id: 'dev', name: 'Development', baseUrl: 'https://dev.api.com' },
                { id: 'staging', name: 'Staging', baseUrl: 'https://staging.api.com' },
                { id: 'prod', name: 'Production', baseUrl: 'https://api.com' },
            ];

            mockConfigManager.getSchemaEnvironments.mockReturnValue(environments);

            jest.spyOn(vscode.window, 'showQuickPick')
                .mockResolvedValue(environments[1] as any);

            jest.spyOn(notebookController, 'createNotebookForEndpoint')
                .mockResolvedValue({} as any);

            const commandHandler = mockVscode.commands.registerCommand.mock.calls
                .find(call => call[0] === 'pathfinder.runInNotebook')?.[1];

            await commandHandler(endpoint, 'test-schema');

            expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
                environments.map(env => ({
                    label: env.name,
                    description: env.baseUrl,
                    environment: env,
                })),
                { placeHolder: 'Select environment for HTTP request notebook' }
            );

            expect(notebookController.createNotebookForEndpoint).toHaveBeenCalledWith(
                endpoint,
                environments[1],
                'test-schema'
            );
        });

        it('should handle case where no environments exist', async () => {
            const endpoint: EndpointInfo = {
                path: '/test',
                method: 'GET',
                operationId: 'test',
            };

            mockConfigManager.getSchemaEnvironments.mockReturnValue([]);

            jest.spyOn(vscode.window, 'showErrorMessage');

            const commandHandler = mockVscode.commands.registerCommand.mock.calls
                .find(call => call[0] === 'pathfinder.runInNotebook')?.[1];

            await commandHandler(endpoint, 'test-schema');

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'No environments found for this schema. Please create an environment first.'
            );
        });

        it('should handle user cancellation of environment picker', async () => {
            const endpoint: EndpointInfo = {
                path: '/test',
                method: 'GET',
                operationId: 'test',
            };

            const environments = [
                { id: 'dev', name: 'Development', baseUrl: 'https://dev.api.com' },
            ];

            mockConfigManager.getSchemaEnvironments.mockReturnValue(environments);

            jest.spyOn(vscode.window, 'showQuickPick')
                .mockResolvedValue(undefined); // User cancelled

            jest.spyOn(notebookController, 'createNotebookForEndpoint');

            const commandHandler = mockVscode.commands.registerCommand.mock.calls
                .find(call => call[0] === 'pathfinder.runInNotebook')?.[1];

            await commandHandler(endpoint, 'test-schema');

            expect(notebookController.createNotebookForEndpoint).not.toHaveBeenCalled();
        });
    });

    describe('Context Menu Integration', () => {
        it('should add notebook option to endpoint context menu', () => {
            // This would test that the context menu includes the notebook option
            // The actual context menu is defined in package.json, but we can test
            // that the command is properly registered and the contextValue is set
            
            const endpoint: EndpointInfo = {
                path: '/example',
                method: 'POST',
                operationId: 'example',
            };

            const treeItem = treeProvider.createEndpointTreeItem(endpoint, 'schema-id');

            expect(treeItem.contextValue).toBe('endpoint');
            expect(mockVscode.commands.registerCommand).toHaveBeenCalledWith(
                'pathfinder.runInNotebook',
                expect.any(Function)
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle notebook creation errors gracefully', async () => {
            const endpoint: EndpointInfo = {
                path: '/error-test',
                method: 'GET',
                operationId: 'errorTest',
            };

            const environment = {
                id: 'test',
                name: 'Test',
                baseUrl: 'https://test.api.com',
            };

            mockConfigManager.getSchemaEnvironments.mockReturnValue([environment]);

            jest.spyOn(notebookController, 'createNotebookForEndpoint')
                .mockRejectedValue(new Error('Failed to create notebook'));

            jest.spyOn(vscode.window, 'showErrorMessage');

            const commandHandler = mockVscode.commands.registerCommand.mock.calls
                .find(call => call[0] === 'pathfinder.runInNotebook')?.[1];

            await commandHandler(endpoint, 'test-schema');

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Failed to create request notebook: Failed to create notebook'
            );
        });
    });
});
