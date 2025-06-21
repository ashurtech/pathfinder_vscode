"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const configuration_1 = require("../src/configuration");
const vscode = __importStar(require("vscode"));
// Mock VS Code API
jest.mock('vscode', () => ({
    window: {
        createWebviewPanel: jest.fn(),
    },
    ViewColumn: {
        One: 1
    },
    workspace: {
        getConfiguration: jest.fn()
    }
}));
describe('ConfigurationManager - Credential Webview Functionality', () => {
    let configManager;
    let mockContext;
    let mockWebviewPanel;
    let mockWebview;
    beforeEach(() => {
        // Create mock context
        mockContext = {
            globalState: {
                get: jest.fn(),
                update: jest.fn()
            },
            secrets: {
                get: jest.fn(),
                store: jest.fn(),
                delete: jest.fn()
            }
        };
        // Create mock webview
        mockWebview = {
            html: '',
            postMessage: jest.fn(),
            onDidReceiveMessage: jest.fn()
        };
        // Create mock webview panel
        mockWebviewPanel = {
            webview: mockWebview,
            dispose: jest.fn()
        };
        // Mock the webview panel creation
        jest.mocked(vscode.window.createWebviewPanel).mockReturnValue(mockWebviewPanel);
        // Create configuration manager
        configManager = new configuration_1.ConfigurationManager(mockContext);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('showCredentialsWebview', () => {
        it('should not create webview when no environments or groups provided', async () => {
            await configManager.showCredentialsWebview([], []);
            expect(vscode.window.createWebviewPanel).not.toHaveBeenCalled();
        });
        it('should create webview panel with correct configuration', async () => {
            const environment = {
                id: 'env-1',
                name: 'Test Environment',
                schemaId: 'schema-1',
                baseUrl: 'https://api.test.com',
                auth: { type: 'bearer' },
                authSecretKey: 'env_secret',
                createdAt: new Date()
            };
            await configManager.showCredentialsWebview([environment], []);
            expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith('setCredentials', 'Set Authentication Credentials', vscode.ViewColumn.One, {
                enableScripts: true,
                retainContextWhenHidden: true
            });
        });
        it('should generate HTML content with environment credentials form', async () => {
            const environment = {
                id: 'env-1',
                name: 'Test Environment',
                schemaId: 'schema-1',
                baseUrl: 'https://api.test.com',
                auth: { type: 'bearer' },
                authSecretKey: 'env_secret',
                createdAt: new Date()
            };
            // Mock getApiSchemas to return a schema
            mockContext.globalState.get.mockImplementation((key) => {
                if (key === 'apiSchemas') {
                    return [{
                            id: 'schema-1',
                            name: 'Test API',
                            version: '1.0.0',
                            source: 'test.json',
                            schema: {},
                            loadedAt: new Date(),
                            lastUpdated: new Date(),
                            isValid: true
                        }];
                }
                return [];
            });
            await configManager.showCredentialsWebview([environment], []);
            expect(mockWebview.html).toContain('Test API');
            expect(mockWebview.html).toContain('Test Environment');
            expect(mockWebview.html).toContain('env_secret');
        });
        it('should handle credential saving message', async () => {
            const environment = {
                id: 'env-1',
                name: 'Test Environment',
                schemaId: 'schema-1',
                baseUrl: 'https://api.test.com',
                auth: { type: 'bearer' },
                authSecretKey: 'env_secret',
                createdAt: new Date()
            };
            mockContext.globalState.get.mockReturnValue([]);
            mockContext.secrets.store.mockResolvedValue(undefined);
            await configManager.showCredentialsWebview([environment], []);
            // Get the message handler
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
            // Simulate saving credentials
            await messageHandler({
                command: 'saveCredentials',
                credentials: {
                    'env_secret': 'test-token-123'
                }
            });
            expect(mockContext.secrets.store).toHaveBeenCalledWith('env_secret', 'test-token-123');
            expect(mockWebview.postMessage).toHaveBeenCalledWith({
                command: 'showSuccess',
                message: 'Successfully saved 1 credential(s)',
                count: 1
            });
        });
        it('should handle credential saving errors', async () => {
            const environment = {
                id: 'env-1',
                name: 'Test Environment',
                schemaId: 'schema-1',
                baseUrl: 'https://api.test.com',
                auth: { type: 'bearer' },
                authSecretKey: 'env_secret',
                createdAt: new Date()
            };
            mockContext.globalState.get.mockReturnValue([]);
            mockContext.secrets.store.mockRejectedValue(new Error('Storage failed'));
            await configManager.showCredentialsWebview([environment], []);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
            await messageHandler({
                command: 'saveCredentials',
                credentials: {
                    'env_secret': 'test-token-123'
                }
            });
            expect(mockWebview.postMessage).toHaveBeenCalledWith({
                command: 'showError',
                message: 'Error saving credentials: Storage failed'
            });
        });
        it('should auto-close webview after successful credential save', async () => {
            jest.useFakeTimers();
            const environment = {
                id: 'env-1',
                name: 'Test Environment',
                schemaId: 'schema-1',
                baseUrl: 'https://api.test.com',
                auth: { type: 'bearer' },
                authSecretKey: 'env_secret',
                createdAt: new Date()
            };
            mockContext.globalState.get.mockReturnValue([]);
            mockContext.secrets.store.mockResolvedValue(undefined);
            await configManager.showCredentialsWebview([environment], []);
            const messageHandler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
            await messageHandler({
                command: 'saveCredentials',
                credentials: {
                    'env_secret': 'test-token-123'
                }
            });
            // Fast forward timers
            jest.advanceTimersByTime(2000);
            expect(mockWebviewPanel.dispose).toHaveBeenCalled();
            jest.useRealTimers();
        });
    });
    describe('checkMissingCredentials', () => {
        it('should identify environments with missing credentials', async () => {
            const environment = {
                id: 'env-1',
                name: 'Test Environment',
                schemaId: 'schema-1',
                baseUrl: 'https://api.test.com',
                auth: { type: 'bearer' },
                authSecretKey: 'env_secret',
                createdAt: new Date()
            };
            // Mock that no credentials exist
            mockContext.secrets.get.mockResolvedValue(undefined);
            const result = await configManager.checkMissingCredentials([environment], []);
            expect(result.missingEnvs).toHaveLength(1);
            expect(result.missingEnvs[0]).toBe(environment);
            expect(result.missingGroups).toHaveLength(0);
        });
        it('should identify environment groups with missing credentials', async () => {
            const group = {
                id: 'group-1',
                name: 'Test Group',
                schemaId: 'schema-1',
                defaultAuth: { type: 'bearer' },
                authSecretKey: 'group_secret',
                createdAt: new Date()
            };
            // Mock that no credentials exist
            mockContext.secrets.get.mockResolvedValue(undefined);
            const result = await configManager.checkMissingCredentials([], [group]);
            expect(result.missingEnvs).toHaveLength(0);
            expect(result.missingGroups).toHaveLength(1);
            expect(result.missingGroups[0]).toBe(group);
        });
        it('should not identify items with existing credentials as missing', async () => {
            const environment = {
                id: 'env-1',
                name: 'Test Environment',
                schemaId: 'schema-1',
                baseUrl: 'https://api.test.com',
                auth: { type: 'bearer' },
                authSecretKey: 'env_secret',
                createdAt: new Date()
            };
            // Mock that credentials exist
            mockContext.secrets.get.mockResolvedValue('existing-token');
            const result = await configManager.checkMissingCredentials([environment], []);
            expect(result.missingEnvs).toHaveLength(0);
            expect(result.missingGroups).toHaveLength(0);
        });
        it('should ignore environments without auth configuration', async () => {
            const environment = {
                id: 'env-1',
                name: 'Test Environment',
                schemaId: 'schema-1',
                baseUrl: 'https://api.test.com',
                auth: { type: 'none' },
                createdAt: new Date()
            };
            const result = await configManager.checkMissingCredentials([environment], []);
            expect(result.missingEnvs).toHaveLength(0);
            expect(result.missingGroups).toHaveLength(0);
        });
    });
    describe('groupItemsBySchema', () => {
        it('should group environments and groups by schema name', async () => {
            const environment = {
                id: 'env-1',
                name: 'Test Environment',
                schemaId: 'schema-1',
                baseUrl: 'https://api.test.com',
                auth: { type: 'bearer' },
                createdAt: new Date()
            };
            const group = {
                id: 'group-1',
                name: 'Test Group',
                schemaId: 'schema-1',
                defaultAuth: { type: 'bearer' },
                createdAt: new Date()
            };
            // Mock getApiSchemas
            mockContext.globalState.get.mockImplementation((key) => {
                if (key === 'apiSchemas') {
                    return [{
                            id: 'schema-1',
                            name: 'Test API',
                            version: '1.0.0',
                            source: 'test.json',
                            schema: {},
                            loadedAt: new Date(),
                            lastUpdated: new Date(),
                            isValid: true
                        }];
                }
                return [];
            });
            // Use reflection to access private method
            const groupedItems = await configManager.groupItemsBySchema([environment], [group]);
            expect(groupedItems.size).toBe(1);
            expect(groupedItems.has('Test API')).toBe(true);
            const testApiItems = groupedItems.get('Test API');
            expect(testApiItems.environments).toHaveLength(1);
            expect(testApiItems.groups).toHaveLength(1);
            expect(testApiItems.environments[0]).toBe(environment);
            expect(testApiItems.groups[0]).toBe(group);
        });
    });
    describe('getSchemaNameForEnvironment', () => {
        it('should return schema name for existing schema', async () => {
            const environment = {
                id: 'env-1',
                name: 'Test Environment',
                schemaId: 'schema-1',
                baseUrl: 'https://api.test.com',
                auth: { type: 'none' },
                createdAt: new Date()
            };
            mockContext.globalState.get.mockImplementation((key) => {
                if (key === 'apiSchemas') {
                    return [{
                            id: 'schema-1',
                            name: 'Test API',
                            version: '1.0.0',
                            source: 'test.json',
                            schema: {},
                            loadedAt: new Date(),
                            lastUpdated: new Date(),
                            isValid: true
                        }];
                }
                return [];
            });
            // Use reflection to access private method
            const schemaName = await configManager.getSchemaNameForEnvironment(environment);
            expect(schemaName).toBe('Test API');
        });
        it('should return "Unknown Schema" for non-existing schema', async () => {
            const environment = {
                id: 'env-1',
                name: 'Test Environment',
                schemaId: 'non-existing-schema',
                baseUrl: 'https://api.test.com',
                auth: { type: 'none' },
                createdAt: new Date()
            };
            mockContext.globalState.get.mockReturnValue([]);
            // Use reflection to access private method
            const schemaName = await configManager.getSchemaNameForEnvironment(environment);
            expect(schemaName).toBe('Unknown Schema');
        });
    });
    describe('getSchemaNameForGroup', () => {
        it('should return schema name for existing schema', async () => {
            const group = {
                id: 'group-1',
                name: 'Test Group',
                schemaId: 'schema-1',
                createdAt: new Date()
            };
            mockContext.globalState.get.mockImplementation((key) => {
                if (key === 'apiSchemas') {
                    return [{
                            id: 'schema-1',
                            name: 'Test API',
                            version: '1.0.0',
                            source: 'test.json',
                            schema: {},
                            loadedAt: new Date(),
                            lastUpdated: new Date(),
                            isValid: true
                        }];
                }
                return [];
            });
            // Use reflection to access private method
            const schemaName = await configManager.getSchemaNameForGroup(group);
            expect(schemaName).toBe('Test API');
        });
        it('should return "Unknown Schema" for non-existing schema', async () => {
            const group = {
                id: 'group-1',
                name: 'Test Group',
                schemaId: 'non-existing-schema',
                createdAt: new Date()
            };
            mockContext.globalState.get.mockReturnValue([]);
            // Use reflection to access private method
            const schemaName = await configManager.getSchemaNameForGroup(group);
            expect(schemaName).toBe('Unknown Schema');
        });
    });
    describe('importConfiguration integration', () => {
        it('should trigger credential webview for imported items with missing credentials', async () => {
            jest.useFakeTimers();
            const importData = {
                version: '1.0.0',
                environments: [{
                        id: 'env-1',
                        name: 'Test Environment',
                        schemaId: 'schema-1',
                        baseUrl: 'https://api.test.com',
                        auth: { type: 'bearer' },
                        authSecretKey: 'env_secret',
                        createdAt: new Date().toISOString()
                    }],
                environmentGroups: [{
                        id: 'group-1',
                        name: 'Test Group',
                        schemaId: 'schema-1',
                        defaultAuth: { type: 'bearer' },
                        authSecretKey: 'group_secret',
                        createdAt: new Date().toISOString()
                    }]
            };
            // Mock missing credentials
            mockContext.secrets.get.mockResolvedValue(undefined);
            mockContext.globalState.get.mockReturnValue([]);
            mockContext.globalState.update.mockResolvedValue(undefined);
            // Spy on showCredentialsWebview
            const showCredentialsWebviewSpy = jest.spyOn(configManager, 'showCredentialsWebview').mockResolvedValue();
            await configManager.importConfiguration(JSON.stringify(importData));
            // Fast forward the setTimeout
            jest.advanceTimersByTime(1000);
            expect(showCredentialsWebviewSpy).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({ id: 'env-1', name: 'Test Environment' })
            ]), expect.arrayContaining([
                expect.objectContaining({ id: 'group-1', name: 'Test Group' })
            ]));
            jest.useRealTimers();
        });
        it('should not trigger credential webview when all credentials exist', async () => {
            const importData = {
                version: '1.0.0',
                environments: [{
                        id: 'env-1',
                        name: 'Test Environment',
                        schemaId: 'schema-1',
                        baseUrl: 'https://api.test.com',
                        auth: { type: 'bearer' },
                        authSecretKey: 'env_secret',
                        createdAt: new Date().toISOString()
                    }]
            };
            // Mock existing credentials
            mockContext.secrets.get.mockResolvedValue('existing-token');
            mockContext.globalState.get.mockReturnValue([]);
            mockContext.globalState.update.mockResolvedValue(undefined);
            // Spy on showCredentialsWebview
            const showCredentialsWebviewSpy = jest.spyOn(configManager, 'showCredentialsWebview').mockResolvedValue();
            await configManager.importConfiguration(JSON.stringify(importData));
            expect(showCredentialsWebviewSpy).not.toHaveBeenCalled();
        });
    });
    describe('HTML content generation', () => {
        it('should generate valid HTML content with form fields', async () => {
            const environment = {
                id: 'env-1',
                name: 'Test Environment',
                schemaId: 'schema-1',
                baseUrl: 'https://api.test.com',
                auth: { type: 'bearer' },
                authSecretKey: 'env_secret',
                createdAt: new Date()
            };
            const group = {
                id: 'group-1',
                name: 'Test Group',
                schemaId: 'schema-1',
                defaultAuth: { type: 'apikey' },
                authSecretKey: 'group_secret',
                createdAt: new Date()
            };
            mockContext.globalState.get.mockImplementation((key) => {
                if (key === 'apiSchemas') {
                    return [{
                            id: 'schema-1',
                            name: 'Test API',
                            version: '1.0.0',
                            source: 'test.json',
                            schema: {},
                            loadedAt: new Date(),
                            lastUpdated: new Date(),
                            isValid: true
                        }];
                }
                return [];
            });
            await configManager.showCredentialsWebview([environment], [group]);
            const htmlContent = mockWebview.html;
            // Check HTML structure
            expect(htmlContent).toContain('<!DOCTYPE html>');
            expect(htmlContent).toContain('<html>');
            expect(htmlContent).toContain('<form id="credentialsForm">');
            expect(htmlContent).toContain('<button type="submit" id="saveButton">');
            // Check schema organization
            expect(htmlContent).toContain('Schema: Test API'); // Check environment group form
            expect(htmlContent).toContain('Environment Groups:');
            expect(htmlContent).toContain('Test Group');
            expect(htmlContent).toContain('apikey');
            expect(htmlContent).toContain('name="group_secret"');
            // Check individual environment form
            expect(htmlContent).toContain('Individual Environments:');
            expect(htmlContent).toContain('Test Environment');
            expect(htmlContent).toContain('bearer');
            expect(htmlContent).toContain('name="env_secret"');
            // Check JavaScript functionality
            expect(htmlContent).toContain('acquireVsCodeApi()');
            expect(htmlContent).toContain('addEventListener("submit"');
            expect(htmlContent).toContain('postMessage');
        });
    });
});
//# sourceMappingURL=credential-webview.test.js.map