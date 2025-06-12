#!/usr/bin/env node

/**
 * Test Extension with Kibana Schema
 * 
 * This script simulates the extension loading the Kibana schema
 * using the improved error handling approach.
 */

const fs = require('fs');
const path = require('path');

// Mock VS Code API for testing
const mockVscode = {
    Uri: {
        file: (filePath) => ({ fsPath: filePath })
    },
    workspace: {
        fs: {
            readFile: async (uri) => {
                const content = fs.readFileSync(uri.fsPath, 'utf8');
                return Buffer.from(content, 'utf8');
            }
        }
    }
};

// Mock SwaggerParser
const SwaggerParser = require('swagger-parser');

console.log('🧪 Testing Extension Schema Loading');
console.log('=' .repeat(50));

async function testExtensionSchemaLoading() {
    const SCHEMA_FILE = path.join(__dirname, 'sample-schemas', 'kibana-openapi-source.json');
    
    // Mock environment
    const environment = {
        id: 'test-env-1',
        name: 'Test Kibana Environment',
        baseUrl: 'https://kibana.example.com',
        auth: { type: 'none' },
        createdAt: new Date()
    };

    console.log('📁 Schema file:', SCHEMA_FILE);
    console.log('🌍 Environment:', environment.name);

    try {
        // Step 1: Read file (simulating VS Code file reading)
        console.log('\n📖 Step 1: Reading schema file...');
        const fileUri = mockVscode.Uri.file(SCHEMA_FILE);
        const fileContent = await mockVscode.workspace.fs.readFile(fileUri);
        const contentString = Buffer.from(fileContent).toString('utf8');
        
        console.log(`✅ File read successfully (${(contentString.length / 1024 / 1024).toFixed(2)}MB)`);

        // Step 2: Parse JSON
        console.log('\n🔧 Step 2: Parsing JSON...');
        let schemaData;
        try {
            schemaData = JSON.parse(contentString);
            console.log('✅ JSON parsing successful');
        } catch (jsonError) {
            console.log('❌ JSON parsing failed:', jsonError.message);
            return;
        }

        // Step 3: Schema validation with improved error handling
        console.log('\n🔍 Step 3: Schema validation with improved error handling...');
        
        const result = {
            schema: null,
            isValid: true,
            validationErrors: []
        };

        try {
            // Lenient parsing first
            const api = await SwaggerParser.parse(schemaData);
            
            if (!api.openapi?.startsWith('3.')) {
                throw new Error('Only OpenAPI 3.x specifications are supported');
            }

            result.schema = api;
            console.log('✅ Lenient parsing successful');

            // Try strict validation
            try {
                await SwaggerParser.validate(api);
                console.log('✅ Strict validation passed');
            } catch (validationError) {
                // Get validation error summary
                let errorSummary = 'Unknown validation error';
                if (validationError.details && Array.isArray(validationError.details)) {
                    const errorCount = validationError.details.length;
                    const firstFewErrors = validationError.details.slice(0, 2).map(detail => {
                        const path = detail.path ? detail.path.join('.') : 'unknown';
                        return `${path}: ${detail.message ?? detail.code}`;
                    });
                    
                    errorSummary = `${errorCount} validation issue(s)`;
                    if (firstFewErrors.length > 0) {
                        errorSummary += `: ${firstFewErrors.join(', ')}`;
                        if (errorCount > 2) {
                            errorSummary += ` (and ${errorCount - 2} more)`;
                        }
                    }
                } else if (validationError.message) {
                    errorSummary = validationError.message.length > 150 ? 
                        validationError.message.substring(0, 150) + '...' : 
                        validationError.message;
                }
                
                console.log('⚠️  Strict validation failed, but schema is still usable');
                console.log('    Error summary:', errorSummary);
                result.isValid = false;
                result.validationErrors.push(errorSummary);
            }

        } catch (parseError) {
            console.log('❌ Schema parsing completely failed:', parseError.message);
            
            // Try to salvage what we can
            if (typeof schemaData === 'object' && schemaData.openapi) {
                console.log('⚠️  Using schema with limited parsing due to errors');
                result.schema = schemaData;
                result.isValid = false;
                result.validationErrors.push(parseError.message);
            } else {
                throw parseError;
            }
        }

        // Step 4: Create LoadedSchema result
        console.log('\n📋 Step 4: Creating LoadedSchema result...');
        const loadedSchema = {
            environmentId: environment.id,
            schema: result.schema,
            source: SCHEMA_FILE,
            loadedAt: new Date(),
            isValid: result.isValid,
            validationErrors: result.validationErrors
        };

        // Step 5: Test basic functionality
        console.log('\n🚀 Step 5: Testing basic functionality...');
        
        if (result.schema && result.schema.info) {
            console.log(`   ✅ Schema Title: ${result.schema.info.title ?? 'Unknown'}`);
            console.log(`   ✅ Schema Version: ${result.schema.info.version ?? 'Unknown'}`);
            console.log(`   ✅ OpenAPI Version: ${result.schema.openapi}`);
            
            // Count paths and endpoints
            const pathCount = result.schema.paths ? Object.keys(result.schema.paths).length : 0;
            let endpointCount = 0;
            
            if (result.schema.paths) {
                Object.values(result.schema.paths).forEach(pathItem => {
                    if (pathItem) {
                        const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];
                        endpointCount += methods.filter(method => pathItem[method]).length;
                    }
                });
            }
            
            console.log(`   ✅ Paths: ${pathCount}`);
            console.log(`   ✅ Total Endpoints: ${endpointCount}`);
            console.log(`   ✅ Servers: ${result.schema.servers?.length ?? 0}`);
        }

        // Final result
        console.log('\n🎉 FINAL RESULT:');
        console.log(`   ✅ Schema loaded: ${loadedSchema.isValid ? 'VALID' : 'VALID WITH WARNINGS'}`);
        console.log(`   ✅ Environment: ${environment.name}`);
        console.log(`   ✅ Source: ${path.basename(loadedSchema.source)}`);
        console.log(`   ✅ Validation errors: ${loadedSchema.validationErrors.length}`);
        
        if (loadedSchema.validationErrors.length > 0) {
            console.log('\n⚠️  Validation warnings (extension will still work):');
            loadedSchema.validationErrors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        }

        console.log('\n✨ SUCCESS: Extension should now be able to load this schema!');
        console.log('   The improved error handling allows the extension to work');
        console.log('   even when schemas have validation warnings.');

    } catch (error) {
        console.error('\n❌ COMPLETE FAILURE:', error.message);
        console.error('   This would be a real failure that the extension cannot recover from.');
    }
}

testExtensionSchemaLoading().catch(console.error);
