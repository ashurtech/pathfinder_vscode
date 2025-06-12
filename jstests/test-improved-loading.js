#!/usr/bin/env node

/**
 * Test the improved schema loading with error handling
 */

const fs = require('fs');
const path = require('path');

// Import the SchemaLoader functionality (simulate it for testing)
const SwaggerParser = require('swagger-parser');

const SCHEMA_FILE = path.join(__dirname, 'sample-schemas', 'kibana-openapi-source.json');

console.log('🧪 Testing Improved Schema Loading with Error Handling');
console.log('📁 Schema file:', SCHEMA_FILE);

async function testImprovedLoading() {
    try {
        console.log('\n📖 Reading schema file...');
        const schemaContent = fs.readFileSync(SCHEMA_FILE, 'utf8');
        const schemaData = JSON.parse(schemaContent);
        
        console.log('✅ JSON parsing successful');
        console.log(`📏 Schema size: ${(schemaContent.length / 1024 / 1024).toFixed(2)}MB`);

        // Step 1: Try lenient parsing first
        console.log('\n🔧 Step 1: Attempting lenient parsing...');
        let api;
        try {
            api = await SwaggerParser.parse(schemaData);
            console.log('✅ Lenient parsing successful!');
            console.log(`   - Title: ${api.info?.title || 'Unknown'}`);
            console.log(`   - Version: ${api.info?.version || 'Unknown'}`);
            console.log(`   - OpenAPI: ${api.openapi}`);
            console.log(`   - Paths: ${Object.keys(api.paths || {}).length}`);
        } catch (parseError) {
            console.log('❌ Even lenient parsing failed:', parseError.message);
            return;
        }

        // Step 2: Try strict validation (expect this to fail, but we'll continue)
        console.log('\n🔍 Step 2: Attempting strict validation...');
        try {
            await SwaggerParser.validate(api);
            console.log('✅ Strict validation passed!');
        } catch (validationError) {
            console.log('⚠️ Strict validation failed, but schema is still usable');
            
            // Extract useful error information
            let errorSummary = 'Unknown validation error';
            if (validationError.details && Array.isArray(validationError.details)) {
                const errorCount = validationError.details.length;
                const firstFewErrors = validationError.details.slice(0, 3).map(detail => {
                    const path = detail.path ? detail.path.join('.') : 'unknown';
                    return `${path}: ${detail.message || detail.code}`;
                });
                
                errorSummary = `${errorCount} validation issue(s)`;
                if (firstFewErrors.length > 0) {
                    errorSummary += `: ${firstFewErrors.join(', ')}`;
                    if (errorCount > 3) {
                        errorSummary += ` (and ${errorCount - 3} more)`;
                    }
                }
            } else if (validationError.message) {
                errorSummary = validationError.message.length > 200 ? 
                    validationError.message.substring(0, 200) + '...' : 
                    validationError.message;
            }
            
            console.log('   Error summary:', errorSummary);
        }

        // Step 3: Test basic functionality with the parsed schema
        console.log('\n🚀 Step 3: Testing basic functionality...');
        
        // Count endpoints
        let endpointCount = 0;
        if (api.paths) {
            Object.values(api.paths).forEach(pathItem => {
                if (pathItem) {
                    const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];
                    endpointCount += methods.filter(method => pathItem[method]).length;
                }
            });
        }
        
        console.log(`   - Total endpoints: ${endpointCount}`);
        console.log(`   - Servers: ${api.servers?.length || 0}`);
        console.log(`   - Components: ${api.components ? Object.keys(api.components).length : 0}`);
        
        console.log('\n🎉 SUCCESS: Schema can be used despite validation warnings!');
        console.log('    The extension should now be able to load this schema with graceful error handling.');

    } catch (error) {
        console.error('\n❌ COMPLETE FAILURE:', error.message);
        console.error('   Stack:', error.stack);
    }
}

testImprovedLoading().catch(console.error);
