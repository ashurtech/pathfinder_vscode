import { HttpRequestParser } from '../src/notebook/http-request-parser';
import { HttpRequestExecutor } from '../src/notebook/http-request-executor';

describe('HTTP Request Parser', () => {
    let parser: HttpRequestParser;

    beforeEach(() => {
        parser = new HttpRequestParser();
    });

    describe('Request Parsing', () => {
        it('should parse simple GET request', () => {
            const httpText = 'GET https://api.example.com/users';

            const parsed = parser.parse(httpText);

            expect(parsed.method).toBe('GET');
            expect(parsed.url).toBe('https://api.example.com/users');
            expect(parsed.headers).toEqual({});
            expect(parsed.body).toBeUndefined();
        });

        it('should parse POST request with headers and body', () => {
            const httpText = `POST https://api.example.com/users
Content-Type: application/json
Authorization: Bearer token123

{
  "name": "John Doe",
  "email": "john@example.com"
}`;

            const parsed = parser.parse(httpText);

            expect(parsed.method).toBe('POST');
            expect(parsed.url).toBe('https://api.example.com/users');
            expect(parsed.headers).toEqual({
                'Content-Type': 'application/json',
                'Authorization': 'Bearer token123'
            });
            expect(parsed.body).toBe('{\n  "name": "John Doe",\n  "email": "john@example.com"\n}');
        });

        it('should parse request with query parameters', () => {
            const httpText = 'GET https://api.example.com/users?page=1&limit=10&sort=name';

            const parsed = parser.parse(httpText);

            expect(parsed.method).toBe('GET');
            expect(parsed.url).toBe('https://api.example.com/users?page=1&limit=10&sort=name');
        });

        it('should handle requests with variables', () => {
            const httpText = `GET {{baseUrl}}/users/{{userId}}
Authorization: {{authToken}}`;

            const variables = {
                baseUrl: 'https://api.example.com',
                userId: '123',
                authToken: 'Bearer secret-token'
            };

            const parsed = parser.parse(httpText, variables);

            expect(parsed.url).toBe('https://api.example.com/users/123');
            expect(parsed.headers['Authorization']).toBe('Bearer secret-token');
        });        it('should handle malformed requests gracefully', () => {
            const httpText = 'INVALID REQUEST FORMAT';

            expect(() => parser.parse(httpText)).toThrow('Invalid HTTP method: INVALID');
        });

        it('should parse multiple headers correctly', () => {
            const httpText = `PUT https://api.example.com/users/123
Content-Type: application/json
Authorization: Bearer token123
X-Custom-Header: custom-value
Accept: application/json

{"name": "Updated Name"}`;

            const parsed = parser.parse(httpText);

            expect(parsed.headers).toEqual({
                'Content-Type': 'application/json',
                'Authorization': 'Bearer token123',
                'X-Custom-Header': 'custom-value',
                'Accept': 'application/json'
            });
        });
    });

    describe('Variable Substitution', () => {
        it('should substitute variables in URL', () => {
            const httpText = 'GET {{protocol}}://{{host}}/{{path}}';
            const variables = {
                protocol: 'https',
                host: 'api.example.com',
                path: 'v1/users'
            };

            const parsed = parser.parse(httpText, variables);

            expect(parsed.url).toBe('https://api.example.com/v1/users');
        });

        it('should substitute variables in headers', () => {
            const httpText = `GET https://api.example.com/users
Authorization: {{authType}} {{token}}
X-API-Version: {{version}}`;

            const variables = {
                authType: 'Bearer',
                token: 'abc123',
                version: 'v2'
            };

            const parsed = parser.parse(httpText, variables);

            expect(parsed.headers['Authorization']).toBe('Bearer abc123');
            expect(parsed.headers['X-API-Version']).toBe('v2');
        });

        it('should substitute variables in request body', () => {
            const httpText = `POST https://api.example.com/users
Content-Type: application/json

{
  "name": "{{userName}}",
  "role": "{{userRole}}",
  "active": {{isActive}}
}`;

            const variables = {
                userName: 'Jane Doe',
                userRole: 'admin',
                isActive: 'true'
            };

            const parsed = parser.parse(httpText, variables);

            expect(parsed.body).toContain('"name": "Jane Doe"');
            expect(parsed.body).toContain('"role": "admin"');
            expect(parsed.body).toContain('"active": true');
        });        it('should handle missing variables gracefully', () => {
            const httpText = 'GET {{baseUrl}}/users/{{userId}}';
            const variables = {
                baseUrl: 'https://api.example.com'
                // userId is missing
            };

            const result = parser.parse(httpText, variables);
            expect(result.url).toBe('https://api.example.com/users/{{userId}}');
        });
    });
});

describe('HTTP Request Executor', () => {
    let executor: HttpRequestExecutor;

    beforeEach(() => {
        executor = new HttpRequestExecutor();
        
        // Mock fetch globally
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('Request Execution', () => {
        it('should execute GET request successfully', async () => {
            const request = {
                method: 'GET',
                url: 'https://api.example.com/users',
                headers: {},
            };

            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Map([
                    ['content-type', 'application/json'],
                    ['x-rate-limit', '100']
                ]),
                json: async () => ([{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }]),
                text: async () => '[{"id":1,"name":"John"},{"id":2,"name":"Jane"}]',
            };

            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            const startTime = Date.now();
            const result = await executor.execute(request);
            const endTime = Date.now();

            expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/users', {
                method: 'GET',
                headers: {},
            });

            expect(result.status).toBe(200);
            expect(result.statusText).toBe('OK');
            expect(result.body).toBe('[{"id":1,"name":"John"},{"id":2,"name":"Jane"}]');
            expect(result.headers).toEqual({
                'content-type': 'application/json',
                'x-rate-limit': '100'
            });
            expect(result.timing).toBeGreaterThanOrEqual(0);
            expect(result.timing).toBeLessThan(endTime - startTime + 100); // Allow some margin
        });

        it('should execute POST request with body', async () => {
            const request = {
                method: 'POST',
                url: 'https://api.example.com/users',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer token123'
                },
                body: '{"name": "New User", "email": "user@example.com"}'
            };

            const mockResponse = {
                ok: true,
                status: 201,
                statusText: 'Created',
                headers: new Map([['content-type', 'application/json']]),
                json: async () => ({ id: 3, name: 'New User', email: 'user@example.com' }),
                text: async () => '{"id":3,"name":"New User","email":"user@example.com"}',
            };

            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            const result = await executor.execute(request);

            expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer token123'
                },
                body: '{"name": "New User", "email": "user@example.com"}'
            });

            expect(result.status).toBe(201);
            expect(result.statusText).toBe('Created');
        });

        it('should handle HTTP error responses', async () => {
            const request = {
                method: 'GET',
                url: 'https://api.example.com/nonexistent',
                headers: {},
            };

            const mockResponse = {
                ok: false,
                status: 404,
                statusText: 'Not Found',
                headers: new Map([['content-type', 'application/json']]),
                json: async () => ({ error: 'Resource not found' }),
                text: async () => '{"error":"Resource not found"}',
            };

            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            const result = await executor.execute(request);

            expect(result.status).toBe(404);
            expect(result.statusText).toBe('Not Found');
            expect(result.body).toBe('{"error":"Resource not found"}');
            expect(result.success).toBe(false);
        });        it('should handle network errors', async () => {
            const request = {
                method: 'GET',
                url: 'https://nonexistent.example.com/api',
                headers: {},
            };

            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error: ENOTFOUND'));

            const result = await executor.execute(request);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Network error: ENOTFOUND');
        });

        it('should include request timing information', async () => {
            const request = {
                method: 'GET',
                url: 'https://api.example.com/slow',
                headers: {},
            };            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Map([['content-type', 'text/plain']]),
                text: async () => {
                    // Simulate slow response
                    await new Promise(resolve => setTimeout(resolve, 100));
                    return 'Slow response';
                },
            };

            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            const result = await executor.execute(request);

            expect(result.timing).toBeGreaterThan(90); // Should be at least 100ms minus some margin
            expect(typeof result.timing).toBe('number');
        });
    });

    describe('Response Processing', () => {
        it('should detect JSON content type and parse response', async () => {
            const request = {
                method: 'GET',
                url: 'https://api.example.com/data',
                headers: {},
            };

            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Map([['content-type', 'application/json; charset=utf-8']]),
                json: async () => ({ message: 'success', data: [1, 2, 3] }),
                text: async () => '{"message":"success","data":[1,2,3]}',
            };

            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            const result = await executor.execute(request);

            expect(result.contentType).toBe('application/json');
            expect(result.parsedBody).toEqual({ message: 'success', data: [1, 2, 3] });
        });

        it('should handle non-JSON responses', async () => {
            const request = {
                method: 'GET',
                url: 'https://api.example.com/health',
                headers: {},
            };

            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Map([['content-type', 'text/plain']]),
                text: async () => 'Server is healthy',
            };

            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            const result = await executor.execute(request);

            expect(result.contentType).toBe('text/plain');
            expect(result.body).toBe('Server is healthy');
            expect(result.parsedBody).toBeUndefined();
        });
    });
});
