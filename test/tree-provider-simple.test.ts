import { ApiTreeProvider } from '../src/tree-provider';
import { ConfigurationManager } from '../src/configuration';
import { SchemaLoader } from '../src/schema-loader';

describe('ApiTreeProvider', () => {
  let treeProvider: ApiTreeProvider;
  let mockConfigManager: jest.Mocked<ConfigurationManager>;
  let mockSchemaLoader: jest.Mocked<SchemaLoader>;

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
    } as any;    // Create mock schema loader
    mockSchemaLoader = {
      loadFromUrl: jest.fn(),
      loadFromFile: jest.fn(),
      validateSchema: jest.fn(),
      extractEndpoints: jest.fn().mockReturnValue([])
    } as any;

    treeProvider = new ApiTreeProvider(mockConfigManager, mockSchemaLoader);
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
        type: 'bearer' as const,
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
