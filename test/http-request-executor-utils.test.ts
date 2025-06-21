/**
 * Unit tests for HttpRequestExecutor validation functions
 * Tests pure validation logic that doesn't require network calls
 */

describe('HttpRequestExecutor Validation Functions', () => {
    // Mock the validation function from HttpRequestExecutor
    const validateRequest = (request: any): { valid: boolean; errors: string[] } => {
        const errors: string[] = [];

        if (!request.method) {
            errors.push('HTTP method is required');
        }

        if (!request.url) {
            errors.push('URL is required');
        }

        try {
            new URL(request.url);
        } catch {
            errors.push('Invalid URL format');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    };

    const validateHeaders = (headers: Record<string, string>): { valid: boolean; errors: string[] } => {
        const errors: string[] = [];

        for (const [key, value] of Object.entries(headers)) {
            if (!key || key.trim().length === 0) {
                errors.push('Header name cannot be empty');
            }

            if (key.includes(' ')) {
                errors.push(`Header name "${key}" cannot contain spaces`);
            }

            if (value === null || value === undefined) {
                errors.push(`Header "${key}" value cannot be null or undefined`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    };

    const sanitizeHeaders = (headers: Record<string, string>): Record<string, string> => {
        const sanitized: Record<string, string> = {};

        for (const [key, value] of Object.entries(headers)) {
            const cleanKey = key.trim();
            const cleanValue = typeof value === 'string' ? value.trim() : String(value);

            if (cleanKey.length > 0) {
                sanitized[cleanKey] = cleanValue;
            }
        }

        return sanitized;
    };

    describe('validateRequest', () => {
        it('should validate complete requests', () => {
            const request = {
                method: 'GET',
                url: 'https://api.example.com/users',
                headers: {}
            };

            const result = validateRequest(request);

            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should detect missing method', () => {
            const request = {
                url: 'https://api.example.com/users',
                headers: {}
            };

            const result = validateRequest(request);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('HTTP method is required');
        });

        it('should detect missing URL', () => {
            const request = {
                method: 'GET',
                headers: {}
            };

            const result = validateRequest(request);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('URL is required');
        });

        it('should detect invalid URL format', () => {
            const request = {
                method: 'GET',
                url: 'not-a-valid-url',
                headers: {}
            };

            const result = validateRequest(request);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Invalid URL format');
        });

        it('should accumulate multiple errors', () => {
            const request = {
                headers: {}
            };

            const result = validateRequest(request);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('HTTP method is required');
            expect(result.errors).toContain('URL is required');
        });
    });

    describe('validateHeaders', () => {
        it('should validate correct headers', () => {
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer token123',
                'X-Custom-Header': 'custom-value'
            };

            const result = validateHeaders(headers);

            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should detect empty header names', () => {
            const headers = {
                '': 'empty-name',
                'Valid-Header': 'valid-value'
            };

            const result = validateHeaders(headers);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Header name cannot be empty');
        });

        it('should detect header names with spaces', () => {
            const headers = {
                'Invalid Header': 'value-with-space-in-name'
            };

            const result = validateHeaders(headers);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Header name "Invalid Header" cannot contain spaces');
        });

        it('should detect null/undefined header values', () => {
            const headers = {
                'Null-Header': null as any,
                'Undefined-Header': undefined as any,
                'Valid-Header': 'valid-value'
            };

            const result = validateHeaders(headers);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Header "Null-Header" value cannot be null or undefined');
            expect(result.errors).toContain('Header "Undefined-Header" value cannot be null or undefined');
        });
    });

    describe('sanitizeHeaders', () => {
        it('should trim header names and values', () => {
            const headers = {
                '  Content-Type  ': '  application/json  ',
                'Authorization': 'Bearer token123',
                ' X-Custom ': ' custom-value '
            };

            const sanitized = sanitizeHeaders(headers);

            expect(sanitized).toEqual({
                'Content-Type': 'application/json',
                'Authorization': 'Bearer token123',
                'X-Custom': 'custom-value'
            });
        });

        it('should remove empty header names', () => {
            const headers = {
                '': 'empty-name',
                '   ': 'whitespace-name',
                'Valid-Header': 'valid-value'
            };

            const sanitized = sanitizeHeaders(headers);

            expect(sanitized).toEqual({
                'Valid-Header': 'valid-value'
            });
        });

        it('should convert non-string values to strings', () => {
            const headers = {
                'Number-Header': 123 as any,
                'Boolean-Header': true as any,
                'String-Header': 'string-value'
            };

            const sanitized = sanitizeHeaders(headers);

            expect(sanitized).toEqual({
                'Number-Header': '123',
                'Boolean-Header': 'true',
                'String-Header': 'string-value'
            });
        });
    });

    describe('Content type helpers', () => {
        const parseContentType = (contentType: string): { type: string; charset?: string } => {
            const [type, ...params] = contentType.split(';').map(s => s.trim());
            const result: { type: string; charset?: string } = { type };

            for (const param of params) {
                const [key, value] = param.split('=').map(s => s.trim());
                if (key === 'charset') {
                    result.charset = value;
                }
            }

            return result;
        };

        const isJsonContentType = (contentType: string): boolean => {
            return contentType.toLowerCase().includes('application/json');
        };

        it('should parse content types', () => {
            expect(parseContentType('application/json')).toEqual({
                type: 'application/json'
            });

            expect(parseContentType('application/json; charset=utf-8')).toEqual({
                type: 'application/json',
                charset: 'utf-8'
            });

            expect(parseContentType('text/html; charset=iso-8859-1')).toEqual({
                type: 'text/html',
                charset: 'iso-8859-1'
            });
        });

        it('should detect JSON content types', () => {
            expect(isJsonContentType('application/json')).toBe(true);
            expect(isJsonContentType('APPLICATION/JSON')).toBe(true);
            expect(isJsonContentType('application/json; charset=utf-8')).toBe(true);
            expect(isJsonContentType('text/html')).toBe(false);
            expect(isJsonContentType('application/xml')).toBe(false);
        });
    });
});
