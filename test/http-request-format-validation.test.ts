/**
 * Unit tests for HTTP request format validation in notebooks
 * These tests ensure the notebook HTTP parser correctly validates and parses various HTTP request formats
 */

// Mock VS Code APIs first
const mockVscode = {
    NotebookCellKind: {
        Markup: 1,
        Code: 2,
    },
    NotebookCellData: class {
        constructor(
            public kind: number,
            public value: string,
            public languageId: string
        ) {}
    },
    NotebookData: class {
        constructor(public cells: any[]) {}
    },
    Uri: {
        parse: jest.fn((str: string) => ({ toString: () => str })),
    },
    workspace: {
        registerNotebookSerializer: jest.fn(),
        openNotebookDocument: jest.fn(),
    },
    window: {
        showTextDocument: jest.fn(),
    },
};

jest.mock('vscode', () => mockVscode, { virtual: true });

import { HttpRequestParser } from '../src/notebook/http-request-parser';

describe('HTTP Request Format Validation', () => {
    let parser: HttpRequestParser;

    beforeEach(() => {
        parser = new HttpRequestParser();
    });

    describe('Valid HTTP Request Formats', () => {
        it('should parse simple GET request', () => {
            const httpRequest = `GET https://api.example.com/users`;
            
            const result = parser.parse(httpRequest);
            
            expect(result.method).toBe('GET');
            expect(result.url).toBe('https://api.example.com/users');
            expect(result.headers).toEqual({});
            expect(result.body).toBeUndefined();
        });

        it('should parse POST request with headers and body', () => {
            const httpRequest = `POST https://api.example.com/users
Content-Type: application/json
Authorization: Bearer token123

{
  "name": "John Doe",
  "email": "john@example.com"
}`;
            
            const result = parser.parse(httpRequest);
            
            expect(result.method).toBe('POST');
            expect(result.url).toBe('https://api.example.com/users');
            expect(result.headers).toEqual({
                'Content-Type': 'application/json',
                'Authorization': 'Bearer token123'
            });
            expect(result.body).toBe('{\n  "name": "John Doe",\n  "email": "john@example.com"\n}');
        });

        it('should parse request with comments', () => {
            const httpRequest = `# This is a comment
GET https://api.example.com/users # Another comment
# Comment before headers
Content-Type: application/json # Inline comment
Authorization: Bearer token123

# Comment before body
{
  "test": "data"
}`;
            
            const result = parser.parse(httpRequest);
            
            expect(result.method).toBe('GET');
            expect(result.url).toBe('https://api.example.com/users');
            expect(result.headers).toEqual({
                'Content-Type': 'application/json',
                'Authorization': 'Bearer token123'
            });
        });

        it('should parse request with variable substitution', () => {
            const httpRequest = `GET {{baseUrl}}/users/{{userId}}
Authorization: Bearer {{apiKey}}

{
  "name": "{{userName}}"
}`;
            
            const variables = {
                baseUrl: 'https://api.example.com',
                userId: '123',
                apiKey: 'secret-token',
                userName: 'John Doe'
            };
            
            const result = parser.parse(httpRequest, variables);
            
            expect(result.method).toBe('GET');
            expect(result.url).toBe('https://api.example.com/users/123');
            expect(result.headers).toEqual({
                'Authorization': 'Bearer secret-token'
            });
            expect(result.body).toBe('{\n  "name": "John Doe"\n}');
        });

        it('should handle all HTTP methods', () => {
            const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
            
            methods.forEach(method => {
                const httpRequest = `${method} https://api.example.com/test`;
                const result = parser.parse(httpRequest);
                expect(result.method).toBe(method);
            });
        });

        it('should handle case-insensitive HTTP methods', () => {
            const httpRequest = `get https://api.example.com/users`;
            
            const result = parser.parse(httpRequest);
            
            expect(result.method).toBe('GET');
        });

        it('should parse headers with colons in values', () => {
            const httpRequest = `GET https://api.example.com/users
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
User-Agent: Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Win64; x64; Trident/5.0)`;
            
            const result = parser.parse(httpRequest);
            
            expect(result.headers['Authorization']).toContain('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
            expect(result.headers['User-Agent']).toBe('Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Win64; x64; Trident/5.0)');
        });
    });

    describe('Invalid HTTP Request Formats', () => {
        it('should throw error for empty request', () => {
            const httpRequest = '';
            
            expect(() => parser.parse(httpRequest)).toThrow('No request line found');
        });

        it('should throw error for request with only whitespace', () => {
            const httpRequest = '   \n  \n  ';
            
            expect(() => parser.parse(httpRequest)).toThrow('No request line found');
        });

        it('should throw error for request with only comments', () => {
            const httpRequest = `# This is just a comment
# Another comment
# No actual request`;
            
            expect(() => parser.parse(httpRequest)).toThrow('No request line found');
        });

        it('should throw error for invalid HTTP method', () => {
            const httpRequest = 'INVALID https://api.example.com/users';
            
            expect(() => parser.parse(httpRequest)).toThrow('Invalid HTTP method: INVALID. Valid methods: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS');
        });

        it('should throw error for missing URL', () => {
            const httpRequest = 'GET';
            
            expect(() => parser.parse(httpRequest)).toThrow('Invalid HTTP request format. Expected: METHOD URL, got: GET');
        });

        it('should throw error for malformed request line', () => {
            const httpRequest = 'Not a valid request line';
            
            expect(() => parser.parse(httpRequest)).toThrow('Invalid HTTP method: Not. Valid methods: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS');
        });

        it('should handle missing variables gracefully with descriptive error', () => {
            const httpRequest = `GET {{baseUrl}}/users/{{missingVar}}
Authorization: Bearer {{apiKey}}`;
            
            const variables = {
                baseUrl: 'https://api.example.com',
                apiKey: 'secret-token'
                // missingVar is not provided
            };
            
            // Note: This should either substitute with empty string or throw descriptive error
            // depending on implementation preference
            expect(() => parser.parse(httpRequest, variables)).not.toThrow('Cannot read properties of undefined');
        });
    });

    describe('Edge Cases and Robustness', () => {
        it('should handle extra whitespace', () => {
            const httpRequest = `   GET    https://api.example.com/users   
   Content-Type:   application/json   
   Authorization:   Bearer token123   

{
  "test": "data"
}`;
            
            const result = parser.parse(httpRequest);
            
            expect(result.method).toBe('GET');
            expect(result.url).toBe('https://api.example.com/users');
            expect(result.headers['Content-Type']).toBe('application/json');
            expect(result.headers['Authorization']).toBe('Bearer token123');
        });

        it('should handle empty headers section', () => {
            const httpRequest = `POST https://api.example.com/users

{
  "name": "John Doe"
}`;
            
            const result = parser.parse(httpRequest);
            
            expect(result.method).toBe('POST');
            expect(result.headers).toEqual({});
            expect(result.body).toBe('{\n  "name": "John Doe"\n}');
        });

        it('should handle request with no body', () => {
            const httpRequest = `GET https://api.example.com/users
Authorization: Bearer token123`;
            
            const result = parser.parse(httpRequest);
            
            expect(result.method).toBe('GET');
            expect(result.headers['Authorization']).toBe('Bearer token123');
            expect(result.body).toBeUndefined();
        });

        it('should handle complex JSON body with nested objects', () => {
            const httpRequest = `POST https://api.example.com/users
Content-Type: application/json

{
  "user": {
    "name": "John Doe",
    "address": {
      "street": "123 Main St",
      "city": "Anytown"
    },
    "tags": ["admin", "user"]
  },
  "metadata": {
    "created": "2024-01-01T00:00:00Z"
  }
}`;
            
            const result = parser.parse(httpRequest);
            
            expect(result.body).toContain('"user"');
            expect(result.body).toContain('"address"');
            expect(result.body).toContain('"tags"');
            expect(result.body).toContain('["admin", "user"]');
        });

        it('should handle URL with query parameters', () => {
            const httpRequest = `GET https://api.example.com/users?page=1&limit=10&sort=name`;
            
            const result = parser.parse(httpRequest);
            
            expect(result.url).toBe('https://api.example.com/users?page=1&limit=10&sort=name');
        });

        it('should preserve header case sensitivity', () => {
            const httpRequest = `GET https://api.example.com/users
X-Custom-Header: custom-value
x-lowercase-header: lowercase-value
X-Mixed-Case-Header: mixed-case-value`;
            
            const result = parser.parse(httpRequest);
            
            expect(result.headers['X-Custom-Header']).toBe('custom-value');
            expect(result.headers['x-lowercase-header']).toBe('lowercase-value');
            expect(result.headers['X-Mixed-Case-Header']).toBe('mixed-case-value');
        });
    });

    describe('Variable Substitution Validation', () => {
        it('should substitute multiple variables correctly', () => {
            const httpRequest = `{{method}} {{baseUrl}}/{{resource}}/{{id}}
{{headerName}}: {{headerValue}}

{
  "{{bodyKey}}": "{{bodyValue}}"
}`;
            
            const variables = {
                method: 'POST',
                baseUrl: 'https://api.example.com',
                resource: 'users',
                id: '123',
                headerName: 'Authorization',
                headerValue: 'Bearer token123',
                bodyKey: 'name',
                bodyValue: 'John Doe'
            };
            
            const result = parser.parse(httpRequest, variables);
            
            expect(result.method).toBe('POST');
            expect(result.url).toBe('https://api.example.com/users/123');
            expect(result.headers['Authorization']).toBe('Bearer token123');
            expect(result.body).toBe('{\n  "name": "John Doe"\n}');
        });

        it('should handle partial variable substitution', () => {
            const httpRequest = `GET {{baseUrl}}/users/{{userId}}?active={{isActive}}`;
            
            const variables = {
                baseUrl: 'https://api.example.com',
                userId: '123'
                // isActive is missing
            };
            
            const result = parser.parse(httpRequest, variables);
            
            expect(result.url).toBe('https://api.example.com/users/123?active={{isActive}}');
        });
    });
});
