import { ApiSchema } from '../src/types';

describe('Type Validation', () => {
    describe('ApiSchema', () => {
        it('should accept valid schema structure', () => {
            const validSchema: ApiSchema = {
                id: 'test-id',
                name: 'Test API',
                schema: {
                    openapi: '3.0.0',
                    info: { title: 'Test', version: '1.0.0' },
                    paths: {}
                },
                source: 'https://api.example.com/openapi.json',
                loadedAt: new Date(),
                lastUpdated: new Date(),
                isValid: true,
                version: '1.0.0'
            };

            expect(validSchema.id).toBe('test-id');
            expect(validSchema.name).toBe('Test API');
            expect(validSchema.isValid).toBe(true);
        });

        it('should handle optional iconOverride property', () => {
            const schemaWithIcon: ApiSchema = {
                id: 'test-id',
                name: 'Test API',
                schema: {
                    openapi: '3.0.0',
                    info: { title: 'Test', version: '1.0.0' },
                    paths: {}
                },
                source: 'https://api.example.com/openapi.json',
                loadedAt: new Date(),
                lastUpdated: new Date(),
                isValid: true,
                version: '1.0.0',
                iconOverride: {
                    useBrandIcon: true,
                    manualIconName: 'github',
                    fallbackToColorIcon: true
                }
            };

            expect(schemaWithIcon.iconOverride?.useBrandIcon).toBe(true);
            expect(schemaWithIcon.iconOverride?.manualIconName).toBe('github');
        });

        it('should handle optional schema_url property', () => {
            const schemaWithUrl: ApiSchema = {
                id: 'test-id',
                name: 'Test API',
                schema: {
                    openapi: '3.0.0',
                    info: { title: 'Test', version: '1.0.0' },
                    paths: {}
                },
                source: 'https://api.example.com/openapi.json',
                schema_url: 'https://api.example.com/openapi.json',
                loadedAt: new Date(),
                lastUpdated: new Date(),
                isValid: true,
                version: '1.0.0'
            };

            expect(schemaWithUrl.schema_url).toBe('https://api.example.com/openapi.json');
        });

        it('should handle color options', () => {
            const colors = ['blue', 'green', 'orange', 'purple', 'red', 'yellow'] as const;
            
            colors.forEach(color => {
                const schema: ApiSchema = {
                    id: 'test-id',
                    name: 'Test API',
                    schema: {
                        openapi: '3.0.0',
                        info: { title: 'Test', version: '1.0.0' },
                        paths: {}
                    },
                    source: 'https://api.example.com/openapi.json',
                    loadedAt: new Date(),
                    lastUpdated: new Date(),
                    isValid: true,
                    version: '1.0.0',
                    color: color
                };

                expect(schema.color).toBe(color);
            });
        });
    });
});
