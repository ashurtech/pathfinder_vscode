/**
 * Unit tests for HTTP Runner secrets handling
 * 
 * These tests ensure that the HTTP runner properly retrieves credentials
 * from VS Code's SecretStorage and handles both schema-first and legacy
 * authentication structures correctly.
 */

import { HttpRequestRunner } from '../src/http-runner';
import { ConfigurationManager } from '../src/configuration';
import * as vscode from 'vscode';

// Mock VS Code API with inline objects to avoid hoisting issues
jest.mock('vscode', () => ({
    window: {
        createWebviewPanel: jest.fn().mockReturnValue({
            webview: {
                postMessage: jest.fn(),
                html: '',
                onDidReceiveMessage: jest.fn()
            },
            dispose: jest.fn(),
            onDidDispose: jest.fn()
        }),
        showTextDocument: jest.fn(),
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        createOutputChannel: jest.fn().mockReturnValue({
            appendLine: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn()
        })
    },
    workspace: {
        openTextDocument: jest.fn().mockResolvedValue({
            uri: { toString: () => 'untitled:test' },
            getText: jest.fn().mockReturnValue('')
        })
    },
    ViewColumn: {
        One: 1
    },
    WebviewPanelType: {},
    EventEmitter: jest.fn(),
    Uri: {
        parse: jest.fn(),
        file: jest.fn()
    }
}));

// Mock VS Code context
const mockContext = {
    secrets: {
        get: jest.fn(),
        store: jest.fn(),
        delete: jest.fn()
    },
    globalState: {
        get: jest.fn().mockReturnValue([]),
        update: jest.fn()
    },
    workspaceState: {
        get: jest.fn(),
        update: jest.fn()
    },
    subscriptions: []
} as any;

describe('HttpRequestRunner - Secrets Handling', () => {
    let httpRunner: HttpRequestRunner;
    let configManager: ConfigurationManager;

    const mockEndpoint = {
        path: '/api/test',
        method: 'GET',
        summary: 'Test endpoint',
        description: 'Test description',
        parameters: [],
        tags: []
    };

    beforeEach(() => {
        jest.clearAllMocks();

        configManager = new ConfigurationManager(mockContext);
        httpRunner = new HttpRequestRunner(configManager);
    });    describe('openRequestEditor - Schema-First Authentication', () => {
        it('should retrieve bearer token credentials from secrets storage', async () => {
            const mockEnvironment = {
                id: 'test-env',
                schemaId: 'test-schema',
                name: 'Test Environment',
                baseUrl: 'https://api.test.com',
                auth: {
                    type: 'bearer'
                },
                authSecretKey: 'test-secret-key',
                createdAt: new Date()
            };

            const mockCredentials = {
                apiKey: 'test-bearer-token'
            };

            // Mock the getCredentials method
            jest.spyOn(configManager, 'getCredentials').mockResolvedValue(mockCredentials);

            await httpRunner.openRequestEditor(mockEndpoint, mockEnvironment);

            expect(configManager.getCredentials).toHaveBeenCalledWith(mockEnvironment);
            expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
            expect(vscode.window.showTextDocument).toHaveBeenCalled();
        });

        it('should retrieve API key credentials from secrets storage', async () => {
            const mockEnvironment = {
                id: 'test-env',
                schemaId: 'test-schema',
                name: 'Test Environment',
                baseUrl: 'https://api.test.com',
                auth: {
                    type: 'apikey',
                    apiKeyName: 'X-Custom-Key'
                },
                authSecretKey: 'test-secret-key',
                createdAt: new Date()
            };

            const mockCredentials = {
                apiKey: 'test-api-key'
            };

            jest.spyOn(configManager, 'getCredentials').mockResolvedValue(mockCredentials);

            await httpRunner.openRequestEditor(mockEndpoint, mockEnvironment);

            expect(configManager.getCredentials).toHaveBeenCalledWith(mockEnvironment);
            expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
        });

        it('should retrieve basic auth credentials from secrets storage', async () => {
            const mockEnvironment = {
                id: 'test-env',
                schemaId: 'test-schema',
                name: 'Test Environment',
                baseUrl: 'https://api.test.com',
                auth: {
                    type: 'basic'
                },
                authSecretKey: 'test-secret-key',
                createdAt: new Date()
            };

            const mockCredentials = {
                username: 'testuser',
                password: 'testpass'
            };

            jest.spyOn(configManager, 'getCredentials').mockResolvedValue(mockCredentials);

            await httpRunner.openRequestEditor(mockEndpoint, mockEnvironment);

            expect(configManager.getCredentials).toHaveBeenCalledWith(mockEnvironment);
            expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
        });

        it('should handle missing credentials gracefully', async () => {
            const mockEnvironment = {
                id: 'test-env',
                schemaId: 'test-schema',
                name: 'Test Environment',
                baseUrl: 'https://api.test.com',
                auth: {
                    type: 'bearer'
                },
                authSecretKey: 'test-secret-key',
                createdAt: new Date()
            };

            // Mock getCredentials to return undefined (no credentials)
            jest.spyOn(configManager, 'getCredentials').mockResolvedValue(undefined);

            await httpRunner.openRequestEditor(mockEndpoint, mockEnvironment);

            expect(configManager.getCredentials).toHaveBeenCalledWith(mockEnvironment);
            expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
            // Should still create the document even without credentials
        });

        it('should fall back to legacy auth when secrets retrieval fails', async () => {
            const mockEnvironment = {
                id: 'test-env',
                name: 'Test Environment',
                baseUrl: 'https://api.test.com',
                auth: {
                    type: 'bearer',
                    bearerToken: 'legacy-token'
                },
                authSecretKey: 'test-secret-key'
            };

            // Mock getCredentials to throw an error
            jest.spyOn(configManager, 'getCredentials').mockRejectedValue(new Error('Secrets retrieval failed'));

            await httpRunner.openRequestEditor(mockEndpoint, mockEnvironment);

            expect(configManager.getCredentials).toHaveBeenCalledWith(mockEnvironment);
            expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
            // Should fall back to legacy auth structure
        });
    });    describe('Legacy Authentication Support', () => {
        it('should handle legacy bearer token authentication', async () => {
            const mockEnvironment = {
                id: 'legacy-env',
                name: 'Legacy Environment',
                baseUrl: 'https://legacy.api.com',
                auth: {
                    type: 'bearer',
                    bearerToken: 'legacy-bearer-token'
                }
                // No authSecretKey - indicates legacy environment
            };

            await httpRunner.openRequestEditor(mockEndpoint, mockEnvironment);

            expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
            expect(vscode.window.showTextDocument).toHaveBeenCalled();
        });

        it('should handle legacy API key authentication', async () => {
            const mockEnvironment = {
                id: 'legacy-env',
                name: 'Legacy Environment',
                baseUrl: 'https://legacy.api.com',
                auth: {
                    type: 'apikey',
                    apiKey: 'legacy-api-key',
                    apiKeyName: 'X-Legacy-Key'
                }
            };

            await httpRunner.openRequestEditor(mockEndpoint, mockEnvironment);

            expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
            expect(vscode.window.showTextDocument).toHaveBeenCalled();
        });

        it('should handle legacy basic authentication', async () => {
            const mockEnvironment = {
                id: 'legacy-env',
                name: 'Legacy Environment',
                baseUrl: 'https://legacy.api.com',
                auth: {
                    type: 'basic',
                    username: 'legacyuser',
                    password: 'legacypass'
                }
            };

            await httpRunner.openRequestEditor(mockEndpoint, mockEnvironment);

            expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
            expect(vscode.window.showTextDocument).toHaveBeenCalled();
        });
    });    describe('Error Handling', () => {
        it('should handle document creation errors', async () => {
            const mockEnvironment = {
                id: 'error-env',
                name: 'Error Environment',
                baseUrl: 'https://error.api.com',
                auth: { type: 'none' }
            };

            // Mock workspace.openTextDocument to throw an error
            (vscode.workspace.openTextDocument as jest.Mock).mockRejectedValue(new Error('Document creation failed'));

            await httpRunner.openRequestEditor(mockEndpoint, mockEnvironment);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to open request editor')
            );
        });        it('should handle undefined auth object', async () => {
            const mockEnvironment = {
                id: 'no-auth-env',
                name: 'No Auth Environment',
                baseUrl: 'https://noauth.api.com'
                // No auth property
            };

            // Add spy to capture any errors
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            
            try {
                await httpRunner.openRequestEditor(mockEndpoint, mockEnvironment);
                expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
                // Should handle gracefully without throwing
            } catch (error) {
                console.log('Test caught error:', error);
                // If it throws, that's actually a failure
                throw error;
            } finally {
                consoleSpy.mockRestore();
            }
        });
    });

    describe('Credential Storage Integration', () => {        it('should store credentials for the document when available', async () => {
            // Create completely fresh instances to avoid any shared state
            const freshMockContext = {
                secrets: {
                    get: jest.fn(),
                    store: jest.fn(),
                    delete: jest.fn()
                },
                globalState: {
                    get: jest.fn().mockReturnValue([]),
                    update: jest.fn()
                },
                workspaceState: {
                    get: jest.fn(),
                    update: jest.fn()
                },
                subscriptions: []
            } as any;

            const freshConfigManager = new ConfigurationManager(freshMockContext);
            const freshHttpRunner = new HttpRequestRunner(freshConfigManager);
            
            const mockEnvironment = {
                id: 'store-env',
                schemaId: 'test-schema',
                name: 'Store Environment',
                baseUrl: 'https://store.api.com',
                auth: {
                    type: 'bearer'
                },
                authSecretKey: 'store-secret-key',
                createdAt: new Date()
            };            const mockCredentials = {
                apiKey: 'store-bearer-token'
            };

            // Mock workspace.openTextDocument specifically for this test
            const originalOpenTextDocument = (vscode.workspace as any).openTextDocument;
            const mockDocument = {
                uri: { toString: () => 'untitled:test-store-credentials' },
                getText: jest.fn().mockReturnValue('')
            };
            (vscode.workspace as any).openTextDocument = jest.fn().mockResolvedValue(mockDocument);

            // Mock getCredentials on the fresh instance
            const getCredentialsSpy = jest.spyOn(freshConfigManager, 'getCredentials').mockResolvedValue(mockCredentials);
            
            // Spy on the storeCredentials method of the fresh instance
            const storeCredentialsSpy = jest.spyOn(freshHttpRunner as any, 'storeCredentials').mockImplementation(() => {});

            try {
                await freshHttpRunner.openRequestEditor(mockEndpoint, mockEnvironment);

                // Verify getCredentials was called
                expect(getCredentialsSpy).toHaveBeenCalledWith(mockEnvironment);
                
                // Verify storeCredentials was called with the correct parameters
                expect(storeCredentialsSpy).toHaveBeenCalledWith(
                    'untitled:test-store-credentials',
                    expect.objectContaining({
                        'Authorization': 'Bearer store-bearer-token'
                    })
                );
            } finally {
                // Restore the original mock
                (vscode.workspace as any).openTextDocument = originalOpenTextDocument;
                getCredentialsSpy.mockRestore();
                storeCredentialsSpy.mockRestore();
            }
        });

        it('should not store credentials when none are available', async () => {
            const mockEnvironment = {
                id: 'no-cred-env',
                name: 'No Credentials Environment',
                baseUrl: 'https://nocred.api.com',
                auth: { type: 'none' }
            };

            const storeCredentialsSpy = jest.spyOn(httpRunner as any, 'storeCredentials').mockImplementation(() => {});

            await httpRunner.openRequestEditor(mockEndpoint, mockEnvironment);

            expect(storeCredentialsSpy).not.toHaveBeenCalled();
        });
    });
});
