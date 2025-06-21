/**
 * Unit tests for environment authentication form handling
 * 
 * These tests ensure that authentication types are properly saved and retrieved,
 * preventing regression of the "Authentication Type reverting to None" bug.
 */

import { EditEnvironmentWebview } from '../src/webviews/edit-environment-form';
import { ConfigurationManager } from '../src/configuration';
import { SchemaEnvironment } from '../src/types';
import * as vscode from 'vscode';

// Mock VS Code API
jest.mock('vscode', () => ({
    window: {
        createWebviewPanel: jest.fn(),
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn()
    },
    ViewColumn: {
        One: 1
    },
    WebviewPanelType: {},
    Uri: {
        parse: jest.fn()
    }
}));

describe('Environment Authentication Form', () => {
    let mockContext: any;
    let mockConfigManager: jest.Mocked<ConfigurationManager>;
    let mockWebviewPanel: any;

    // Helper function to create valid test environment
    const createTestEnvironment = (overrides: any = {}): SchemaEnvironment => ({
        id: 'test-env',
        name: 'Test Environment',
        baseUrl: 'https://api.example.com',
        schemaId: 'test-schema',
        createdAt: new Date(),
        auth: {
            type: 'none'
        },
        ...overrides
    });

    beforeEach(() => {
        // Mock VS Code context
        mockContext = {
            secrets: {
                get: jest.fn(),
                store: jest.fn(),
                delete: jest.fn()
            },
            workspaceState: {
                get: jest.fn(),
                update: jest.fn()
            },
            extensionPath: '/mock/path'
        };

        // Mock webview panel
        mockWebviewPanel = {
            webview: {
                html: '',
                postMessage: jest.fn(),
                onDidReceiveMessage: jest.fn()
            },
            dispose: jest.fn(),
            onDidDispose: jest.fn()
        };

        // Mock VS Code API
        (vscode.window.createWebviewPanel as jest.Mock).mockReturnValue(mockWebviewPanel);        // Mock ConfigurationManager
        mockConfigManager = {
            setCredentials: jest.fn(),
            getCredentials: jest.fn(),
            deleteCredentials: jest.fn(),
            saveSchemaEnvironment: jest.fn()
        } as any;
    });

    describe('Authentication Type Persistence', () => {        it('should preserve authentication type when editing environment with basic auth', async () => {
            const environment = createTestEnvironment({
                auth: {
                    type: 'basic',
                    username: 'testuser'
                },
                authSecretKey: 'test-secret-key'
            });

            const webview = new EditEnvironmentWebview(
                mockContext,
                mockConfigManager,
                environment,
                jest.fn()
            );

            // Get the HTML content
            const htmlContent = (webview as any).getWebviewContent();

            // Verify that Basic Authentication is selected in the dropdown
            expect(htmlContent).toContain('<option value="basic" selected>Basic Authentication</option>');
            expect(htmlContent).not.toContain('<option value="none" selected>None</option>');
        });        it('should preserve authentication type when editing environment with API key auth', async () => {
            const environment = createTestEnvironment({
                auth: {
                    type: 'apikey',
                    apiKeyName: 'X-API-Key'
                },
                authSecretKey: 'test-secret-key'
            });

            const webview = new EditEnvironmentWebview(
                mockContext,
                mockConfigManager,
                environment,
                jest.fn()
            );

            const htmlContent = (webview as any).getWebviewContent();

            expect(htmlContent).toContain('<option value="apikey" selected>API Key</option>');
            expect(htmlContent).not.toContain('<option value="none" selected>None</option>');
        });        it('should preserve authentication type when editing environment with bearer token auth', async () => {
            const environment = createTestEnvironment({
                auth: {
                    type: 'bearer'
                },
                authSecretKey: 'test-secret-key'
            });

            const webview = new EditEnvironmentWebview(
                mockContext,
                mockConfigManager,
                environment,
                jest.fn()
            );

            const htmlContent = (webview as any).getWebviewContent();

            expect(htmlContent).toContain('<option value="bearer" selected>Bearer Token</option>');
            expect(htmlContent).not.toContain('<option value="none" selected>None</option>');
        });

        it('should show None as selected for environments without authentication', async () => {
            const environment = createTestEnvironment({
                auth: {
                    type: 'none'
                }
            });

            const webview = new EditEnvironmentWebview(
                mockContext,
                mockConfigManager,
                environment,
                jest.fn()
            );

            const htmlContent = (webview as any).getWebviewContent();

            expect(htmlContent).toContain('<option value="none" selected>None</option>');
        });
    });

    describe('Credential Security', () => {        it('should not expose existing credentials in form fields', async () => {
            const environment = createTestEnvironment({
                auth: {
                    type: 'basic',
                    username: 'testuser'
                },
                authSecretKey: 'test-secret-key'
            });

            const webview = new EditEnvironmentWebview(
                mockContext,
                mockConfigManager,
                environment,
                jest.fn()
            );

            const htmlContent = (webview as any).getWebviewContent();

            // Password field should not have a value, only a placeholder
            expect(htmlContent).toContain('placeholder="Leave empty to keep existing password"');
            expect(htmlContent).not.toContain('value="password123"');
            
            // API key and bearer token fields should also be secure
            expect(htmlContent).toContain('type="password"');
        });

        it('should show helpful placeholders for existing credentials', async () => {
            const environment = createTestEnvironment({
                auth: {
                    type: 'apikey'
                },
                authSecretKey: 'test-secret-key'
            });

            const webview = new EditEnvironmentWebview(
                mockContext,
                mockConfigManager,
                environment,
                jest.fn()
            );

            const htmlContent = (webview as any).getWebviewContent();

            expect(htmlContent).toContain('placeholder="Leave empty to keep existing key"');
        });
    });

    describe('Form Submission', () => {        it('should preserve existing credentials when form fields are empty', async () => {
            const environment = createTestEnvironment({
                auth: {
                    type: 'basic',
                    username: 'testuser'
                },
                authSecretKey: 'existing-secret-key'
            });

            mockConfigManager.getCredentials.mockResolvedValue({
                username: 'testuser',
                password: 'existingPassword'
            });

            const webview = new EditEnvironmentWebview(
                mockContext,
                mockConfigManager,
                environment,
                jest.fn()
            );

            // Simulate form submission with empty password (keep existing)
            const formData = {
                name: 'Test Environment',
                baseUrl: 'https://api.example.com',
                authType: 'basic',
                username: 'testuser',
                password: '' // Empty - should keep existing
            };

            await (webview as any).handleFormSubmission(formData);

            // Should have called setCredentials with existing password
            expect(mockConfigManager.setCredentials).toHaveBeenCalledWith(
                expect.objectContaining({
                    auth: { type: 'basic', username: 'testuser' }
                }),
                {
                    username: 'testuser',
                    password: 'existingPassword'
                }
            );
        });

        it('should update credentials when new values are provided', async () => {
            const environment = createTestEnvironment({
                auth: {
                    type: 'basic',
                    username: 'testuser'
                },
                authSecretKey: 'existing-secret-key'
            });

            const webview = new EditEnvironmentWebview(
                mockContext,
                mockConfigManager,
                environment,
                jest.fn()
            );

            // Simulate form submission with new credentials
            const formData = {
                name: 'Test Environment',
                baseUrl: 'https://api.example.com',
                authType: 'basic',
                username: 'newuser',
                password: 'newpassword'
            };

            await (webview as any).handleFormSubmission(formData);

            expect(mockConfigManager.setCredentials).toHaveBeenCalledWith(
                expect.objectContaining({
                    auth: { type: 'basic', username: 'newuser' }
                }),
                {
                    username: 'newuser',
                    password: 'newpassword'
                }
            );
        });

        it('should clear credentials when switching to no authentication', async () => {
            const environment = createTestEnvironment({
                auth: {
                    type: 'basic',
                    username: 'testuser'
                },
                authSecretKey: 'existing-secret-key'
            });

            const webview = new EditEnvironmentWebview(
                mockContext,
                mockConfigManager,
                environment,
                jest.fn()
            );

            // Simulate switching to no authentication
            const formData = {
                name: 'Test Environment',
                baseUrl: 'https://api.example.com',
                authType: 'none'
            };

            await (webview as any).handleFormSubmission(formData);

            // Should have deleted existing credentials
            expect(mockConfigManager.deleteCredentials).toHaveBeenCalledWith(environment);
              // Should have saved environment with no auth
            expect(mockConfigManager.saveSchemaEnvironment).toHaveBeenCalledWith(
                expect.objectContaining({
                    auth: { type: 'none' },
                    authSecretKey: undefined
                })
            );
        });

        it('should handle switching authentication types properly', async () => {
            const environment = createTestEnvironment({
                auth: {
                    type: 'basic',
                    username: 'testuser'
                },
                authSecretKey: 'existing-secret-key'
            });

            const webview = new EditEnvironmentWebview(
                mockContext,
                mockConfigManager,
                environment,
                jest.fn()
            );

            // Simulate switching from basic to API key auth
            const formData = {
                name: 'Test Environment',
                baseUrl: 'https://api.example.com',
                authType: 'apikey',
                apiKeyLocation: 'header',
                apiKeyName: 'X-API-Key',
                apiKey: 'new-api-key-123'
            };

            await (webview as any).handleFormSubmission(formData);

            // Should have deleted old credentials
            expect(mockConfigManager.deleteCredentials).toHaveBeenCalledWith(environment);
            
            // Should have set new API key credentials
            expect(mockConfigManager.setCredentials).toHaveBeenCalledWith(
                expect.objectContaining({
                    auth: {
                        type: 'apikey',
                        apiKeyLocation: 'header',
                        apiKeyName: 'X-API-Key'
                    }
                }),
                {
                    apiKey: 'new-api-key-123'
                }
            );
        });
    });

    describe('Error Handling', () => {        it('should require credentials for new authentication setup', async () => {
            const environment = createTestEnvironment({
                auth: {
                    type: 'none'
                }
                // No authSecretKey - no existing credentials
            });

            const webview = new EditEnvironmentWebview(
                mockContext,
                mockConfigManager,
                environment,
                jest.fn()
            );

            // Mock webview postMessage to capture error messages
            const postMessageSpy = jest.fn();
            (webview as any).panel = {
                webview: {
                    postMessage: postMessageSpy
                },
                dispose: jest.fn()
            };

            // Try to set basic auth without providing credentials
            const formData = {
                name: 'Test Environment',
                baseUrl: 'https://api.example.com',
                authType: 'basic',
                username: '',
                password: ''
            };

            await (webview as any).handleFormSubmission(formData);

            // Verify error message was sent to webview
            expect(postMessageSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    command: 'showError',
                    error: expect.stringContaining('Username and password are required for Basic Authentication')
                })
            );
        });        it('should handle credential retrieval errors gracefully', async () => {
            const environment = createTestEnvironment({
                auth: {
                    type: 'basic',
                    username: 'testuser'
                },
                authSecretKey: 'existing-secret-key'
            });

            // Mock credential retrieval failure
            mockConfigManager.getCredentials.mockRejectedValue(new Error('Credential access failed'));

            const webview = new EditEnvironmentWebview(
                mockContext,
                mockConfigManager,
                environment,
                jest.fn()
            );

            // Mock webview postMessage to capture error messages
            const postMessageSpy = jest.fn();
            (webview as any).panel = {
                webview: {
                    postMessage: postMessageSpy
                },
                dispose: jest.fn()
            };

            const formData = {
                name: 'Test Environment',
                baseUrl: 'https://api.example.com',
                authType: 'basic',
                username: 'testuser',
                password: '' // Empty - should fail to retrieve existing
            };

            await (webview as any).handleFormSubmission(formData);

            // Verify error message was sent to webview (the error from getCredentials is caught and re-thrown)
            expect(postMessageSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    command: 'showError',
                    error: expect.stringContaining('Credential access failed')
                })
            );
        });
    });
});
