const SwaggerParser = require('swagger-parser');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Extension Schema Loading');

async function testExtensionSchemaLoading() {
    const SCHEMA_FILE = path.join(__dirname, 'sample-schemas', 'kibana-openapi-source.json');
    
    try {
        console.log('📖 Reading schema file...');
        const schemaContent = fs.readFileSync(SCHEMA_FILE, 'utf8');
        const schemaData = JSON.parse(schemaContent);
        
        console.log('✅ JSON parsing successful');
        
        // Test lenient parsing (what the improved extension will do)
        console.log('🔧 Testing lenient parsing...');
        const api = await SwaggerParser.parse(schemaData);
        
        console.log('✅ Lenient parsing successful!');
        console.log(`   - Title: ${api.info?.title}`);
        console.log(`   - Version: ${api.info?.version}`);
        console.log(`   - Paths: ${Object.keys(api.paths || {}).length}`);
        
        // Test strict validation (expect warnings)
        try {
            await SwaggerParser.validate(api);
            console.log('✅ Strict validation passed');
        } catch (validationError) {
            console.log('⚠️  Validation warnings (but schema is usable):');
            console.log('   Error count:', validationError.details?.length || 1);
        }
        
        console.log('\n🎉 SUCCESS: Extension can load this schema!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testExtensionSchemaLoading();
