// Debug script to test parsing of the Kibana schema file
const fs = require('fs');
const path = require('path');

// Import swagger-parser to test it directly
const SwaggerParser = require('swagger-parser');

console.log('🔍 Debug: Kibana Schema Parsing Test\n');

const kibanaFile = path.join(__dirname, 'sample-schemas', 'kibana-openapi-source.json');

console.log(`📁 File path: ${kibanaFile}`);
console.log(`📏 File exists: ${fs.existsSync(kibanaFile)}`);

if (fs.existsSync(kibanaFile)) {
    const stats = fs.statSync(kibanaFile);
    console.log(`📊 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    try {
        console.log('\n🔄 Step 1: Reading file with fs.readFileSync...');
        const content = fs.readFileSync(kibanaFile, 'utf8');
        console.log(`✅ Read ${content.length} characters`);
        console.log(`📄 First 200 chars: ${content.substring(0, 200)}...`);
        
        console.log('\n🔄 Step 2: Parsing JSON with JSON.parse...');
        const jsonData = JSON.parse(content);
        console.log(`✅ JSON parsed successfully`);
        console.log(`📋 Schema title: ${jsonData.info?.title || 'Unknown'}`);
        console.log(`🔢 Schema version: ${jsonData.info?.version || 'Unknown'}`);
        console.log(`🌐 OpenAPI version: ${jsonData.openapi || 'Unknown'}`);
        
        if (jsonData.paths) {
            console.log(`🛤️ Number of paths: ${Object.keys(jsonData.paths).length}`);
        }
        
        console.log('\n🔄 Step 3: Validating with swagger-parser...');
        SwaggerParser.validate(jsonData)
            .then(api => {
                console.log(`✅ Swagger-parser validation successful!`);
                console.log(`📝 API Title: ${api.info?.title}`);
                console.log(`🔢 API Version: ${api.info?.version}`);
                console.log(`🌐 OpenAPI Version: ${api.openapi}`);
                
                if (api.paths) {
                    const pathCount = Object.keys(api.paths).length;
                    console.log(`🛤️ Validated Paths: ${pathCount}`);
                    
                    // Count endpoints
                    let endpointCount = 0;
                    Object.values(api.paths).forEach(pathItem => {
                        if (pathItem) {
                            const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];
                            endpointCount += methods.filter(method => pathItem[method]).length;
                        }
                    });
                    console.log(`🎯 Total Endpoints: ${endpointCount}`);
                }
                
                console.log('\n✅ All validation steps completed successfully!');
            })
            .catch(error => {
                console.error('\n❌ Swagger-parser validation failed:');
                console.error(`Error name: ${error.name}`);
                console.error(`Error message: ${error.message}`);
                if (error.details) {
                    console.error(`Error details:`, error.details);
                }
                console.error('Full error:', error);
            });
        
    } catch (error) {
        console.error('\n❌ Error during parsing:');
        console.error(`Error name: ${error.name}`);
        console.error(`Error message: ${error.message}`);
        console.error('Full error:', error);
    }
} else {
    console.log('❌ Kibana schema file not found');
}
