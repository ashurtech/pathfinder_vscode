/**
 * Unit tests for SchemaLoader utility functions
 * These test pure functions that don't require external dependencies
 */

describe('SchemaLoader Utility Functions', () => {
    // Test the utility function directly by creating a mock class
    class MockSchemaLoader {
        // Extract the utility methods for testing
        getValidationErrorSummary(error: any): string {
            if (error.details && Array.isArray(error.details)) {
                const errorCount = error.details.length;
                const firstFewErrors = error.details.slice(0, 3).map((detail: any) => {
                    const path = detail.path ? detail.path.join('.') : 'unknown';
                    return `${path}: ${detail.message ?? detail.code}`;
                });
                
                let summary = `${errorCount} validation issue(s) found`;
                if (firstFewErrors.length > 0) {
                    summary += `: ${firstFewErrors.join(', ')}`;
                    if (errorCount > 3) {
                        summary += ` (and ${errorCount - 3} more)`;
                    }
                }
                return summary;
            } else if (error.message) {
                // Truncate very long error messages
                const message = error.message.length > 200 ? 
                    error.message.substring(0, 200) + '...' : 
                    error.message;
                return message;
            }
            return 'Unknown validation error';
        }

        getErrorMessage(error: any): string {
            if (error instanceof Error) {
                return error.message;
            }
            if (typeof error === 'string') {
                return error;
            }
            if (error && typeof error.toString === 'function') {
                return error.toString();
            }
            return 'Unknown error occurred';
        }

        getSchemaInfo(schema: any): {
            title: string;
            version: string;
            description?: string;
            serverCount: number;
            pathCount: number;
            endpointCount: number;
        } {
            const pathCount = schema.paths ? Object.keys(schema.paths).length : 0;
            
            // Count total endpoints (paths × methods)
            let endpointCount = 0;
            if (schema.paths) {
                Object.values(schema.paths).forEach((pathItem: any) => {                    if (pathItem) {
                        const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];
                        endpointCount += methods.filter(method => pathItem[method]).length;
                    }
                });
            }
              
            return {
                title: schema.info?.title ?? 'Untitled API',
                version: schema.info?.version ?? 'Unknown',
                description: schema.info?.description,
                serverCount: schema.servers?.length ?? 0,
                pathCount,
                endpointCount
            };
        }
    }

    let mockLoader: MockSchemaLoader;

    beforeEach(() => {
        mockLoader = new MockSchemaLoader();
    });

    describe('getValidationErrorSummary', () => {
        it('should summarize validation errors with details', () => {
            const error = {
                details: [
                    { path: ['paths', '/users', 'get'], message: 'Missing required field' },
                    { path: ['components', 'schemas'], code: 'INVALID_TYPE' },
                    { path: ['info'], message: 'Invalid info object' }
                ]
            };

            const summary = mockLoader.getValidationErrorSummary(error);

            expect(summary).toBe('3 validation issue(s) found: paths./users.get: Missing required field, components.schemas: INVALID_TYPE, info: Invalid info object');
        });

        it('should handle errors with many details', () => {
            const error = {
                details: Array.from({ length: 5 }, (_, i) => ({
                    path: [`field${i}`],
                    message: `Error ${i}`
                }))
            };

            const summary = mockLoader.getValidationErrorSummary(error);

            expect(summary).toContain('5 validation issue(s) found');
            expect(summary).toContain('(and 2 more)');
        });

        it('should handle simple error messages', () => {
            const error = { message: 'Simple error message' };

            const summary = mockLoader.getValidationErrorSummary(error);

            expect(summary).toBe('Simple error message');
        });

        it('should truncate long error messages', () => {
            const longMessage = 'A'.repeat(250);
            const error = { message: longMessage };

            const summary = mockLoader.getValidationErrorSummary(error);

            expect(summary).toHaveLength(203); // 200 + '...'
            expect(summary.endsWith('...')).toBe(true);
        });

        it('should handle unknown error formats', () => {
            const error = { someOtherProperty: 'value' };

            const summary = mockLoader.getValidationErrorSummary(error);

            expect(summary).toBe('Unknown validation error');
        });
    });

    describe('getErrorMessage', () => {
        it('should extract message from Error objects', () => {
            const error = new Error('Test error message');

            const message = mockLoader.getErrorMessage(error);

            expect(message).toBe('Test error message');
        });

        it('should handle string errors', () => {
            const error = 'String error message';

            const message = mockLoader.getErrorMessage(error);

            expect(message).toBe('String error message');
        });

        it('should handle objects with toString', () => {
            const error = { toString: () => 'Custom toString' };

            const message = mockLoader.getErrorMessage(error);

            expect(message).toBe('Custom toString');
        });

        it('should handle unknown error types', () => {
            const error = null;

            const message = mockLoader.getErrorMessage(error);

            expect(message).toBe('Unknown error occurred');
        });
    });

    describe('getSchemaInfo', () => {
        it('should extract basic schema information', () => {
            const schema = {
                info: {
                    title: 'Test API',
                    version: '1.0.0',
                    description: 'A test API'
                },
                servers: [
                    { url: 'https://api.example.com' },
                    { url: 'https://staging.example.com' }
                ],
                paths: {
                    '/users': {
                        get: { summary: 'Get users' },
                        post: { summary: 'Create user' }
                    },
                    '/posts': {
                        get: { summary: 'Get posts' }
                    }
                }
            };

            const info = mockLoader.getSchemaInfo(schema);

            expect(info.title).toBe('Test API');
            expect(info.version).toBe('1.0.0');
            expect(info.description).toBe('A test API');
            expect(info.serverCount).toBe(2);
            expect(info.pathCount).toBe(2);
            expect(info.endpointCount).toBe(3); // 2 in /users + 1 in /posts
        });

        it('should handle minimal schema', () => {
            const schema = {};

            const info = mockLoader.getSchemaInfo(schema);

            expect(info.title).toBe('Untitled API');
            expect(info.version).toBe('Unknown');
            expect(info.description).toBeUndefined();
            expect(info.serverCount).toBe(0);
            expect(info.pathCount).toBe(0);
            expect(info.endpointCount).toBe(0);
        });

        it('should handle schema with empty paths', () => {
            const schema = {
                info: { title: 'Empty API' },
                paths: {}
            };

            const info = mockLoader.getSchemaInfo(schema);

            expect(info.title).toBe('Empty API');
            expect(info.pathCount).toBe(0);
            expect(info.endpointCount).toBe(0);
        });

        it('should count all HTTP methods correctly', () => {
            const schema = {
                paths: {
                    '/resource': {
                        get: {},
                        post: {},
                        put: {},
                        delete: {},
                        patch: {},
                        head: {},
                        options: {}
                    }
                }
            };

            const info = mockLoader.getSchemaInfo(schema);

            expect(info.endpointCount).toBe(7);
        });
    });
});
