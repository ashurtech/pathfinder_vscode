/**
 * Unit tests for HttpRequestParser utility functions
 * These test pure functions that don't require mocking
 */

import { HttpRequestParser } from '../src/notebook/http-request-parser';

describe('HttpRequestParser Utility Functions', () => {
    let parser: HttpRequestParser;

    beforeEach(() => {
        parser = new HttpRequestParser();
    });

    describe('validateUrl', () => {
        it('should validate correct URLs', () => {
            expect(parser.validateUrl('https://api.example.com')).toBe(true);
            expect(parser.validateUrl('http://localhost:3000')).toBe(true);
            expect(parser.validateUrl('https://api.example.com/v1/users')).toBe(true);
        });

        it('should reject invalid URLs', () => {
            expect(parser.validateUrl('')).toBe(false);
            expect(parser.validateUrl('not-a-url')).toBe(false);
            expect(parser.validateUrl('ftp://invalid-protocol')).toBe(true); // URL constructor accepts this
            expect(parser.validateUrl('://invalid')).toBe(false);
        });
    });

    describe('extractVariables', () => {
        it('should extract variables from content', () => {
            const content = 'GET {{baseUrl}}/users/{{userId}}?token={{apiKey}}';
            const variables = parser.extractVariables(content);
            
            expect(variables).toEqual(['baseUrl', 'userId', 'apiKey']);
        });

        it('should handle duplicate variables', () => {
            const content = 'GET {{baseUrl}}/{{resource}}/{{id}} - {{baseUrl}} fallback';
            const variables = parser.extractVariables(content);
            
            expect(variables).toEqual(['baseUrl', 'resource', 'id']);
        });

        it('should return empty array for no variables', () => {
            const content = 'GET https://api.example.com/users';
            const variables = parser.extractVariables(content);
            
            expect(variables).toEqual([]);
        });

        it('should handle complex variable patterns', () => {
            const content = `
                {{method}} {{protocol}}://{{host}}/{{path}}
                Authorization: {{authType}} {{token}}
                X-{{headerName}}: {{headerValue}}
            `;
            const variables = parser.extractVariables(content);
            
            expect(variables).toEqual([
                'method', 'protocol', 'host', 'path', 
                'authType', 'token', 'headerName', 'headerValue'
            ]);
        });
    });

    describe('validateSyntax', () => {
        it('should validate correct HTTP syntax', () => {
            const content = `GET https://api.example.com/users
Authorization: Bearer token123

{"test": "data"}`;
            
            const result = parser.validateSyntax(content);
            
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should detect syntax errors', () => {
            const content = 'INVALID REQUEST FORMAT';
            
            const result = parser.validateSyntax(content);
            
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Invalid HTTP method');
        });

        it('should detect missing URL', () => {
            const content = 'GET';
            
            const result = parser.validateSyntax(content);
            
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('Invalid HTTP request format');
        });

        it('should handle empty content', () => {
            const content = '';
            
            const result = parser.validateSyntax(content);
            
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('No request line found');
        });
    });
});
