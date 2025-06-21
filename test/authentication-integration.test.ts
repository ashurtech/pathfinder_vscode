/**
 * Integration tests for the complete authentication flow
 * 
 * These tests ensure that the full authentication cycle works correctly
 * from form editing to HTTP request execution, preventing regression of
 * the authentication issues that were previously fixed.
 */

import { EditEnvironmentWebview } from '../src/webviews/edit-environment-form';
import { ConfigurationManager } from '../src/configuration';
import { HttpRequestRunner } from '../src/http-runner';
import { SchemaEnvironment } from '../src/types';
import * as vscode from 'vscode';

// Mock VS Code API
jest.mock('vscode', () => ({
    window: {
        createWebviewPanel: jest.fn(),
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn()
    },
    workspace: {
        openTextDocument: jest.fn()
    },
    ViewColumn: {
        One: 1
    }
}));

describe('Authentication Integration Flow', () => {
    let mockContext: any;
    let configManager: ConfigurationManager;
    let httpRunner: HttpRequestRunner;

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
                get: jest.fn().mockReturnValue([]),
                update: jest.fn()
            },
            globalState: {
                get: jest.fn().mockReturnValue([]),
                update: jest.fn()
            },
            extensionPath: '/mock/path',
            subscriptions: []
        };

        configManager = new ConfigurationManager(mockContext);
        httpRunner = new HttpRequestRunner(configManager);

        // Mock webview panel
        const mockWebviewPanel = {
            webview: {
                html: '',
                postMessage: jest.fn(),
                onDidReceiveMessage: jest.fn()
            },
            dispose: jest.fn(),
            onDidDispose: jest.fn()
        };

        (vscode.window.createWebviewPanel as jest.Mock).mockReturnValue(mockWebviewPanel);
        
        // Mock document creation
        const mockDocument = {
            uri: { toString: () => 'untitled:test-integration' },
            getText: jest.fn().mockReturnValue('')
        };
        (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument);
    });

    describe('Complete Authentication Flow', () => {
        it('should save credentials in form and use them in HTTP requests', async () => {
            // Step 1: Create environment with authentication
            const environment = createTestEnvironment({
                auth: { type: 'basic', username: 'testuser' }
            });

            // Step 2: Use ConfigurationManager to set credentials
            const secretKey = await configManager.setCredentials(environment, {
                username: 'testuser',
                password: 'testpass123'
            });

            environment.authSecretKey = secretKey;

            // Step 3: Verify credentials are stored
            expect(mockContext.secrets.store).toHaveBeenCalledWith(
                secretKey,
                expect.stringContaining('testpass123')
            );            // Step 4: Simulate HTTP request that should use these credentials
            const endpointInfo = {
                path: '/api/test',
                method: 'GET',
                summary: 'Test endpoint'
            };

            await httpRunner.openRequestEditor(endpointInfo, environment);

            // Step 5: Verify credentials were retrieved for HTTP request
            expect(mockContext.secrets.get).toHaveBeenCalledWith(secretKey);
        });

        it('should handle credential updates from form to HTTP requests', async () => {
            // Step 1: Start with existing environment with credentials
            const environment = createTestEnvironment({
                auth: { type: 'basic', username: 'olduser' },
                authSecretKey: 'existing-secret-key'
            });

            // Mock existing credentials
            mockContext.secrets.get.mockResolvedValue(JSON.stringify({
                username: 'olduser',
                password: 'oldpass'
            }));

            // Step 2: Simulate form update with new credentials
            const webview = new EditEnvironmentWebview(
                mockContext,
                configManager,
                environment,
                jest.fn()
            );

            // Mock the form submission with updated credentials
            const formData = {
                name: 'Test Environment',
                baseUrl: 'https://api.example.com',
                authType: 'basic',
                username: 'newuser',
                password: 'newpass123'
            };

            await (webview as any).handleFormSubmission(formData);

            // Step 3: Verify old credentials were deleted and new ones stored
            expect(mockContext.secrets.delete).toHaveBeenCalledWith('existing-secret-key');
            expect(mockContext.secrets.store).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('newpass123')
            );
        });

        it('should preserve credentials when only non-credential fields change', async () => {
            // Step 1: Create environment with credentials
            const environment = createTestEnvironment({
                auth: { type: 'basic', username: 'testuser' },
                authSecretKey: 'existing-secret-key'
            });

            // Mock existing credentials
            mockContext.secrets.get.mockResolvedValue(JSON.stringify({
                username: 'testuser',
                password: 'existingpass'
            }));

            // Step 2: Update only non-credential fields (like name)
            const webview = new EditEnvironmentWebview(
                mockContext,
                configManager,
                environment,
                jest.fn()
            );

            const formData = {
                name: 'Updated Environment Name',  // Changed
                baseUrl: 'https://api.example.com',
                authType: 'basic',
                username: 'testuser',
                password: ''  // Empty - should preserve existing
            };

            await (webview as any).handleFormSubmission(formData);

            // Step 3: Verify credentials were preserved (retrieved and re-stored with existing password)
            expect(mockContext.secrets.get).toHaveBeenCalledWith('existing-secret-key');
            // Should store credentials with existing password
            expect(mockContext.secrets.store).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('existingpass')
            );
        });

        it('should handle authentication type switching correctly', async () => {
            // Step 1: Start with basic auth
            const environment = createTestEnvironment({
                auth: { type: 'basic', username: 'testuser' },
                authSecretKey: 'basic-secret-key'
            });

            // Step 2: Switch to API key authentication
            const webview = new EditEnvironmentWebview(
                mockContext,
                configManager,
                environment,
                jest.fn()
            );

            const formData = {
                name: 'Test Environment',
                baseUrl: 'https://api.example.com',
                authType: 'apikey',
                apiKeyLocation: 'header',
                apiKeyName: 'X-API-Key',
                apiKey: 'new-api-key-123'
            };

            await (webview as any).handleFormSubmission(formData);

            // Step 3: Verify old credentials deleted and new API key stored
            expect(mockContext.secrets.delete).toHaveBeenCalledWith('basic-secret-key');
            expect(mockContext.secrets.store).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('new-api-key-123')
            );
        });

        it('should handle credential retrieval failures gracefully in HTTP requests', async () => {
            // Step 1: Create environment with credentials that will fail to retrieve
            const environment = createTestEnvironment({
                auth: { type: 'bearer' },
                authSecretKey: 'failing-secret-key'
            });

            // Step 2: Mock credential retrieval failure
            mockContext.secrets.get.mockRejectedValue(new Error('Secrets storage error'));            // Step 3: HTTP request should handle this gracefully
            const endpointInfo = {
                path: '/api/test',
                method: 'GET',
                summary: 'Test endpoint'
            };

            await httpRunner.openRequestEditor(endpointInfo, environment);

            // Step 4: Should have attempted to retrieve credentials but handled failure
            expect(mockContext.secrets.get).toHaveBeenCalledWith('failing-secret-key');
            // Request should still proceed (may fall back to no auth or show error)
        });

        it('should prevent context undefined errors during credential operations', async () => {
            // Step 1: Create ConfigurationManager with undefined context (edge case)
            const brokenConfigManager = new ConfigurationManager(undefined as any);

            // Step 2: Attempt credential operations
            const environment = createTestEnvironment({
                auth: { type: 'basic', username: 'testuser' }
            });

            // These should not throw errors, but return undefined or handle gracefully
            const credentials = await brokenConfigManager.getCredentials(environment);
            expect(credentials).toBeUndefined();

            // Setting credentials should also handle gracefully
            await expect(brokenConfigManager.setCredentials(environment, { username: 'test', password: 'test' }))
                .resolves.not.toThrow();
        });
    });

    describe('Edge Cases and Error Conditions', () => {
        it('should handle malformed credential data in storage', async () => {
            const environment = createTestEnvironment({
                auth: { type: 'basic', username: 'testuser' },
                authSecretKey: 'malformed-secret-key'
            });

            // Mock malformed JSON in storage
            mockContext.secrets.get.mockResolvedValue('invalid-json-data');            // Should handle gracefully
            const endpointInfo = {
                path: '/api/test',
                method: 'GET',
                summary: 'Test endpoint'
            };

            await httpRunner.openRequestEditor(endpointInfo, environment);

            expect(mockContext.secrets.get).toHaveBeenCalled();
        });

        it('should handle missing authSecretKey gracefully', async () => {
            const environment = createTestEnvironment({
                auth: { type: 'basic', username: 'testuser' }
                // No authSecretKey property
            });            // Should not crash
            const endpointInfo = {
                path: '/api/test',
                method: 'GET',
                summary: 'Test endpoint'
            };

            await httpRunner.openRequestEditor(endpointInfo, environment);

            // Should not attempt to retrieve credentials
            expect(mockContext.secrets.get).not.toHaveBeenCalled();
        });
    });
});
