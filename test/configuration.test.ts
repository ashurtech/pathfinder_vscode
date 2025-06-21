import { ConfigurationManager } from '../src/configuration';
import { ApiSchema, SchemaEnvironmentGroup, SchemaEnvironment } from '../src/types';
import * as vscode from 'vscode';

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;
  let mockContext: any;

  beforeEach(() => {
    // Create a mock VS Code extension context
    mockContext = {
      globalState: {
        get: jest.fn(),
        update: jest.fn(),
        keys: jest.fn(() => [])
      },
      workspaceState: {
        get: jest.fn(),
        update: jest.fn(),
        keys: jest.fn(() => [])
      },
      secrets: {
        get: jest.fn(),
        store: jest.fn(),
        delete: jest.fn()
      },
      subscriptions: [],
      extensionUri: { fsPath: '/mock/path' },
      extensionPath: '/mock/path'
    };

    configManager = new ConfigurationManager(mockContext);
  });

  describe('API Schema Management', () => {
    it('should return empty array when no schemas exist', async () => {
      mockContext.globalState.get.mockReturnValue([]);

      const schemas = await configManager.getApiSchemas();

      expect(schemas).toEqual([]);
      expect(mockContext.globalState.get).toHaveBeenCalledWith('apiSchemas', []);
    });    it('should save a new API schema', async () => {
      const mockSchema: ApiSchema = {
        id: 'test-schema-1',
        name: 'Test API',
        version: '1.0.0',
        source: 'https://api.example.com/openapi.json',
        schema: { openapi: '3.0.0', info: { title: 'Test API', version: '1.0.0' }, paths: {} },
        loadedAt: new Date(),
        lastUpdated: new Date(),
        isValid: true
      };

      mockContext.globalState.get.mockReturnValue([]);
      mockContext.globalState.update.mockResolvedValue(undefined);

      await configManager.saveApiSchema(mockSchema);

      expect(mockContext.globalState.update).toHaveBeenCalledWith('apiSchemas', [mockSchema]);
    });    it('should update existing API schema', async () => {
      const existingSchema: ApiSchema = {
        id: 'test-schema-1',
        name: 'Test API',
        version: '1.0.0',
        source: 'https://api.example.com/openapi.json',
        schema: { openapi: '3.0.0', info: { title: 'Test API', version: '1.0.0' }, paths: {} },
        loadedAt: new Date('2023-01-01'),
        lastUpdated: new Date('2023-01-01'),
        isValid: true
      };

      const updatedSchema: ApiSchema = {
        ...existingSchema,
        name: 'Updated Test API',
        lastUpdated: new Date('2023-01-02')
      };

      mockContext.globalState.get.mockReturnValue([existingSchema]);
      mockContext.globalState.update.mockResolvedValue(undefined);

      await configManager.saveApiSchema(updatedSchema);

      // Check that the schema was updated (lastUpdated will be current date)
      expect(mockContext.globalState.update).toHaveBeenCalledWith('apiSchemas', [
        expect.objectContaining({
          id: 'test-schema-1',
          name: 'Updated Test API',
          // lastUpdated will be current date, not the passed-in date
          lastUpdated: expect.any(Date)
        })
      ]);
    });

    it('should delete an API schema', async () => {
      const schema1: ApiSchema = {
        id: 'test-schema-1',
        name: 'Test API 1',
        version: '1.0.0',
        source: 'https://api.example.com/openapi.json',
        schema: { openapi: '3.0.0', info: { title: 'Test API 1', version: '1.0.0' }, paths: {} },
        loadedAt: new Date(),
        lastUpdated: new Date(),
        isValid: true
      };

      const schema2: ApiSchema = {
        id: 'test-schema-2',
        name: 'Test API 2',
        version: '2.0.0',
        source: 'https://api2.example.com/openapi.json',
        schema: { openapi: '3.0.0', info: { title: 'Test API 2', version: '2.0.0' }, paths: {} },
        loadedAt: new Date(),
        lastUpdated: new Date(),
        isValid: true
      };

      mockContext.globalState.get.mockReturnValue([schema1, schema2]);
      mockContext.globalState.update.mockResolvedValue(undefined);

      await configManager.deleteApiSchema('test-schema-1');

      expect(mockContext.globalState.update).toHaveBeenCalledWith('apiSchemas', [schema2]);
    });
  });

  describe('Environment Group Management', () => {
    it('should save environment group with default authentication', async () => {
      const mockGroup: SchemaEnvironmentGroup = {
        id: 'test-group-1',
        name: 'Test Group',
        schemaId: 'test-schema-1',
        createdAt: new Date(),
        defaultAuth: {
          type: 'bearer',
          bearerToken: 'test-token'
        }
      };

      mockContext.globalState.get.mockReturnValue([]);
      mockContext.globalState.update.mockResolvedValue(undefined);

      await configManager.saveSchemaEnvironmentGroup(mockGroup);

      expect(mockContext.globalState.update).toHaveBeenCalledWith('schemaEnvironmentGroups', [mockGroup]);
    });

    it('should resolve environment authentication correctly', async () => {
      const mockEnvironment: SchemaEnvironment = {
        id: 'env-1',
        name: 'Dev Environment',
        schemaId: 'test-schema-1',
        baseUrl: 'https://dev.api.example.com',
        auth: {
          type: 'bearer',
          bearerToken: 'env-specific-token'
        },
        createdAt: new Date()
      };

      mockContext.globalState.get
        .mockReturnValueOnce([]) // apiSchemas
        .mockReturnValueOnce([{ // schemaEnvironmentGroups
          id: 'test-group-1',
          name: 'Test Group',
          schemaId: 'test-schema-1',
          createdAt: new Date(),
          defaultAuth: {
            type: 'bearer',
            bearerToken: 'group-default-token'
          }
        }]);

      const resolvedAuth = await configManager.resolveEnvironmentAuth(mockEnvironment);

      expect(resolvedAuth.auth).toEqual({
        type: 'bearer',
        bearerToken: 'env-specific-token'
      });
    });
  });

  describe('Extension Settings', () => {    it('should get extension settings with defaults', () => {
      const mockConfiguration = {
        get: jest.fn()
          .mockImplementation((key: string, defaultValue: any) => {
            const settings: { [key: string]: any } = {
              'requestTimeout': 30000,
              'defaultCodeFormat': 'curl',
              'autoValidateSchemas': true,
              'maxHistoryItems': 50
            };
            return settings[key] !== undefined ? settings[key] : defaultValue;
          })
      };

      jest.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfiguration as any);

      const settings = configManager.getExtensionSettings();

      expect(settings).toEqual({
        requestTimeout: 30000,
        defaultCodeFormat: 'curl',
        autoValidateSchemas: true,
        maxHistoryItems: 50
      });

      expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('pathfinder');
    });it('should update extension settings', async () => {
      const mockConfiguration = {
        update: jest.fn().mockResolvedValue(undefined)
      };

      jest.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfiguration as any);

      const settings = {
        requestTimeout: 15000,
        defaultCodeFormat: 'curl' as const,
        autoValidateSchemas: true,
        maxHistoryItems: 50
      };

      await configManager.updateExtensionSettings(settings);

      expect(mockConfiguration.update).toHaveBeenCalledWith('requestTimeout', 15000, vscode.ConfigurationTarget.Global);
    });
  });
});
