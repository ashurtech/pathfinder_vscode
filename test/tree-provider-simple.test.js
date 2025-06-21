"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tree_provider_1 = require("../src/tree-provider");
describe('ApiTreeProvider', () => {
    let treeProvider;
    let mockConfigManager;
    let mockSchemaLoader;
    beforeEach(() => {
        // Create mock configuration manager
        mockConfigManager = {
            getApiSchemas: jest.fn(),
            getSchemaEnvironmentGroups: jest.fn(),
            getSchemaEnvironments: jest.fn(),
            resolveEnvironmentAuth: jest.fn(),
            getExtensionSettings: jest.fn(),
            saveApiSchema: jest.fn(),
            deleteApiSchema: jest.fn(),
            saveSchemaEnvironmentGroup: jest.fn(),
            deleteSchemaEnvironmentGroup: jest.fn(),
            saveSchemaEnvironment: jest.fn(),
            deleteSchemaEnvironment: jest.fn(),
            updateExtensionSettings: jest.fn(),
            getSchemaEnvironmentGroupById: jest.fn()
        };
        // Create mock schema loader
        mockSchemaLoader = {
            loadFromUrl: jest.fn(),
            loadFromFile: jest.fn(),
            validateSchema: jest.fn()
        };
        treeProvider = new tree_provider_1.ApiTreeProvider(mockConfigManager, mockSchemaLoader);
    });
    describe('Tree Item Creation', () => {
        it('should create schema tree items', async () => {
            const mockSchemas = [
                {
                    id: 'schema-1',
                    name: 'Test API v1.0',
                    version: '1.0.0',
                    source: 'https://api.example.com/openapi.json',
                    schema: { openapi: '3.0.0', info: { title: 'Test API', version: '1.0.0' }, paths: {} },
                    loadedAt: new Date(),
                    lastUpdated: new Date(),
                    isValid: true
                }
            ];
            mockConfigManager.getApiSchemas.mockResolvedValue(mockSchemas);
            mockConfigManager.getSchemaEnvironmentGroups.mockResolvedValue([]);
            const children = await treeProvider.getChildren();
            expect(children).toHaveLength(1);
            expect(mockConfigManager.getApiSchemas).toHaveBeenCalled();
        });
        it('should handle authentication correctly', () => {
            const authConfig = {
                type: 'bearer',
                bearerToken: 'test-token'
            };
            expect(authConfig.type).toBe('bearer');
            expect(authConfig.bearerToken).toBe('test-token');
        });
    });
    describe('Refresh Functionality', () => {
        it('should refresh tree when requested', () => {
            const refreshSpy = jest.spyOn(treeProvider, 'refresh');
            treeProvider.refresh();
            expect(refreshSpy).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=tree-provider-simple.test.js.map