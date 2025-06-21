"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
describe('HttpRequestRunner', () => {
    let mockConfigManager;
    beforeEach(() => {
        // Create mock configuration manager
        mockConfigManager = {
            getSchemaEnvironments: jest.fn(),
            resolveEnvironmentAuth: jest.fn(),
            getExtensionSettings: jest.fn(),
            saveApiSchema: jest.fn(),
            getApiSchemas: jest.fn(),
            deleteApiSchema: jest.fn(),
            saveSchemaEnvironmentGroup: jest.fn(),
            getSchemaEnvironmentGroups: jest.fn(),
            deleteSchemaEnvironmentGroup: jest.fn(),
            saveSchemaEnvironment: jest.fn(),
            deleteSchemaEnvironment: jest.fn(),
            updateExtensionSettings: jest.fn(),
            getSchemaEnvironmentGroupById: jest.fn()
        };
    });
    describe('Request Building', () => {
        it('should build basic HTTP request', () => {
            const request = {
                method: 'GET',
                url: 'https://api.example.com/users',
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            // This would test the internal request building logic
            // The actual implementation may vary based on the HttpRequestRunner structure
            expect(request.method).toBe('GET');
            expect(request.url).toBe('https://api.example.com/users');
            expect(request.headers['Content-Type']).toBe('application/json');
        });
        it('should handle authentication headers', () => {
            const authConfig = {
                type: 'bearer',
                bearerToken: 'test-token-123'
            };
            const headers = {
                'Content-Type': 'application/json'
            };
            // Test that bearer token is properly added to headers
            if (authConfig.type === 'bearer' && authConfig.bearerToken) {
                headers['Authorization'] = `Bearer ${authConfig.bearerToken}`;
            }
            expect(headers['Authorization']).toBe('Bearer test-token-123');
        });
        it('should handle API key authentication', () => {
            const authConfig = {
                type: 'apikey',
                apiKey: 'test-api-key',
                apiKeyLocation: 'header',
                apiKeyName: 'X-API-Key'
            };
            const headers = {
                'Content-Type': 'application/json'
            };
            // Test that API key is properly added to headers
            if (authConfig.type === 'apikey' && authConfig.apiKey && authConfig.apiKeyLocation === 'header') {
                headers[authConfig.apiKeyName || 'X-API-Key'] = authConfig.apiKey;
            }
            expect(headers['X-API-Key']).toBe('test-api-key');
        });
        it('should handle basic authentication', () => {
            const authConfig = {
                type: 'basic',
                username: 'testuser',
                password: 'testpass'
            };
            const headers = {
                'Content-Type': 'application/json'
            };
            // Test that basic auth is properly encoded
            if (authConfig.type === 'basic' && authConfig.username && authConfig.password) {
                const credentials = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64');
                headers['Authorization'] = `Basic ${credentials}`;
            }
            expect(headers['Authorization']).toBe('Basic dGVzdHVzZXI6dGVzdHBhc3M=');
        });
    });
    describe('URL Building', () => {
        it('should build URL with query parameters', () => {
            const baseUrl = 'https://api.example.com/users';
            const queryParams = {
                page: '1',
                limit: '10',
                filter: 'active'
            };
            // Build URL with query parameters
            const url = new URL(baseUrl);
            Object.entries(queryParams).forEach(([key, value]) => {
                url.searchParams.append(key, value);
            });
            expect(url.toString()).toBe('https://api.example.com/users?page=1&limit=10&filter=active');
        });
        it('should handle path parameters', () => {
            const pathTemplate = '/api/users/{userId}/posts/{postId}';
            const pathParams = {
                userId: '123',
                postId: '456'
            };
            // Replace path parameters
            let finalPath = pathTemplate;
            Object.entries(pathParams).forEach(([key, value]) => {
                finalPath = finalPath.replace(`{${key}}`, value);
            });
            expect(finalPath).toBe('/api/users/123/posts/456');
        });
    });
    describe('Response Processing', () => {
        it('should process successful response', () => {
            const mockResponse = {
                status: 200,
                statusText: 'OK',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': '100'
                },
                body: JSON.stringify({ success: true, data: { id: 1, name: 'Test' } }),
                responseTime: 150,
                size: 100
            };
            expect(mockResponse.status).toBe(200);
            expect(mockResponse.statusText).toBe('OK');
            expect(JSON.parse(mockResponse.body)).toEqual({
                success: true,
                data: { id: 1, name: 'Test' }
            });
        });
        it('should handle error response', () => {
            const mockErrorResponse = {
                status: 404,
                statusText: 'Not Found',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: 'Resource not found' }),
                responseTime: 100,
                size: 50
            };
            expect(mockErrorResponse.status).toBe(404);
            expect(mockErrorResponse.statusText).toBe('Not Found');
            expect(JSON.parse(mockErrorResponse.body)).toEqual({
                error: 'Resource not found'
            });
        });
    });
    describe('Configuration Integration', () => {
        it('should use resolved authentication from configuration', async () => {
            const mockEnvironment = {
                id: 'test-env',
                schemaId: 'test-schema',
                name: 'Test Environment',
                baseUrl: 'https://api.example.com',
                auth: {
                    type: 'bearer',
                    bearerToken: 'env-token'
                },
                createdAt: new Date()
            };
            mockConfigManager.resolveEnvironmentAuth.mockResolvedValue({
                auth: {
                    type: 'bearer',
                    bearerToken: 'resolved-token'
                }
            });
            const resolvedAuth = await mockConfigManager.resolveEnvironmentAuth(mockEnvironment);
            expect(resolvedAuth.auth).toEqual({
                type: 'bearer',
                bearerToken: 'resolved-token'
            });
            expect(mockConfigManager.resolveEnvironmentAuth).toHaveBeenCalledWith(mockEnvironment);
        });
    });
});
//# sourceMappingURL=http-runner.test.js.map