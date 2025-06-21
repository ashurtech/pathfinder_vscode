/**
 * Unit tests for Configuration utility functions
 * Tests pure helper functions that don't require VS Code context
 */

describe('Configuration Utility Functions', () => {
    describe('Environment validation helpers', () => {
        // Test helper functions that can be extracted or tested as static methods
          const validateEnvironmentName = (name: string): { valid: boolean; errors: string[] } => {
            const errors: string[] = [];
            
            if (!name || name.trim().length === 0) {
                errors.push('Environment name is required');
                return { valid: false, errors }; // Early return for empty names
            }
            
            if (name.length > 100) {
                errors.push('Environment name must be 100 characters or less');
            }
            
            if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
                errors.push('Environment name can only contain letters, numbers, spaces, hyphens, and underscores');
            }
            
            return {
                valid: errors.length === 0,
                errors
            };
        };

        const validateUrl = (url: string): { valid: boolean; errors: string[] } => {
            const errors: string[] = [];
            
            if (!url || url.trim().length === 0) {
                errors.push('URL is required');
                return { valid: false, errors }; // Early return for empty URLs
            }
            
            try {
                const parsed = new URL(url);
                if (!['http:', 'https:'].includes(parsed.protocol)) {
                    errors.push('URL must use http or https protocol');
                }
            } catch {
                errors.push('Invalid URL format');
            }
            
            return {
                valid: errors.length === 0,
                errors
            };
        };

        const sanitizeEnvironmentName = (name: string): string => {
            return name
                .trim()
                .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Remove invalid characters
                .substring(0, 100); // Limit length
        };

        it('should validate environment names', () => {
            expect(validateEnvironmentName('Valid Environment')).toEqual({
                valid: true,
                errors: []
            });

            expect(validateEnvironmentName('')).toEqual({
                valid: false,
                errors: ['Environment name is required']
            });

            expect(validateEnvironmentName('Invalid@Name!')).toEqual({
                valid: false,
                errors: ['Environment name can only contain letters, numbers, spaces, hyphens, and underscores']
            });

            expect(validateEnvironmentName('A'.repeat(101))).toEqual({
                valid: false,
                errors: ['Environment name must be 100 characters or less']
            });
        });

        it('should validate URLs', () => {
            expect(validateUrl('https://api.example.com')).toEqual({
                valid: true,
                errors: []
            });

            expect(validateUrl('http://localhost:3000')).toEqual({
                valid: true,
                errors: []
            });

            expect(validateUrl('')).toEqual({
                valid: false,
                errors: ['URL is required']
            });

            expect(validateUrl('not-a-url')).toEqual({
                valid: false,
                errors: ['Invalid URL format']
            });

            expect(validateUrl('ftp://invalid-protocol.com')).toEqual({
                valid: false,
                errors: ['URL must use http or https protocol']
            });
        });

        it('should sanitize environment names', () => {
            expect(sanitizeEnvironmentName('  Valid Name  ')).toBe('Valid Name');
            expect(sanitizeEnvironmentName('Invalid@Name!')).toBe('InvalidName');
            expect(sanitizeEnvironmentName('A'.repeat(150))).toBe('A'.repeat(100));
            expect(sanitizeEnvironmentName('Test-Name_123')).toBe('Test-Name_123');
        });
    });

    describe('Schema ID generation', () => {        const generateSchemaId = (name: string, source: string): string => {
            const timestamp = Date.now();
            const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const sourceHash = source.split('').reduce((hash, char) => {
                const charCode = char.charCodeAt(0);
                return ((hash << 5) - hash) + charCode;
            }, 0);
            
            return `schema-${sanitizedName}-${Math.abs(sourceHash).toString(36)}-${timestamp.toString(36)}`;
        };

        it('should generate unique schema IDs', () => {
            // Use a small delay to ensure different timestamps
            const id1 = generateSchemaId('Test API', 'https://api.example.com');
            
            // Wait a tiny bit to ensure different timestamp
            const start = Date.now();
            while (Date.now() === start) {
                // Busy wait for 1ms
            }
            
            const id2 = generateSchemaId('Test API', 'https://api.example.com');
            
            expect(id1).toMatch(/^schema-test-api-[a-z0-9]+-[a-z0-9]+$/);
            expect(id2).toMatch(/^schema-test-api-[a-z0-9]+-[a-z0-9]+$/);
            expect(id1).not.toBe(id2); // Should be unique due to timestamp
        });

        it('should handle special characters in names', () => {
            const id = generateSchemaId('My API v2.0!', 'file://local/schema.json');
            
            expect(id).toMatch(/^schema-my-api-v2-0--[a-z0-9]+-[a-z0-9]+$/);
        });
    });

    describe('Authentication config helpers', () => {
        const validateAuthConfig = (auth: any): { valid: boolean; errors: string[] } => {
            const errors: string[] = [];
            
            if (!auth || typeof auth !== 'object') {
                errors.push('Authentication configuration is required');
                return { valid: false, errors };
            }
            
            const validTypes = ['none', 'apikey', 'bearer', 'basic'];
            if (!validTypes.includes(auth.type)) {
                errors.push(`Invalid authentication type. Must be one of: ${validTypes.join(', ')}`);
            }
            
            if (auth.type === 'apikey' && !auth.keyName) {
                errors.push('API key name is required for API key authentication');
            }
            
            if (auth.type === 'basic' && (!auth.username || !auth.password)) {
                errors.push('Username and password are required for basic authentication');
            }
            
            return {
                valid: errors.length === 0,
                errors
            };
        };

        it('should validate authentication configurations', () => {
            expect(validateAuthConfig({ type: 'none' })).toEqual({
                valid: true,
                errors: []
            });

            expect(validateAuthConfig({ type: 'bearer', token: 'abc123' })).toEqual({
                valid: true,
                errors: []
            });

            expect(validateAuthConfig({ type: 'apikey', keyName: 'X-API-Key', keyValue: 'secret' })).toEqual({
                valid: true,
                errors: []
            });

            expect(validateAuthConfig({ type: 'basic', username: 'user', password: 'pass' })).toEqual({
                valid: true,
                errors: []
            });

            expect(validateAuthConfig(null)).toEqual({
                valid: false,
                errors: ['Authentication configuration is required']
            });

            expect(validateAuthConfig({ type: 'invalid' })).toEqual({
                valid: false,
                errors: ['Invalid authentication type. Must be one of: none, apikey, bearer, basic']
            });

            expect(validateAuthConfig({ type: 'apikey' })).toEqual({
                valid: false,
                errors: ['API key name is required for API key authentication']
            });

            expect(validateAuthConfig({ type: 'basic', username: 'user' })).toEqual({
                valid: false,
                errors: ['Username and password are required for basic authentication']
            });
        });
    });
});
