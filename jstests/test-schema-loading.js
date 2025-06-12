// Test script to verify schema loading functionality
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Schema Loading Functionality...\n');

// Check if sample schemas exist
const sampleDir = path.join(__dirname, 'sample-schemas');
console.log('📁 Checking sample schemas directory...');

if (fs.existsSync(sampleDir)) {
    const files = fs.readdirSync(sampleDir);
    console.log('✅ Sample schemas found:');
    files.forEach(file => {
        const filePath = path.join(sampleDir, file);
        const stats = fs.statSync(filePath);
        console.log(`   - ${file} (${(stats.size / 1024).toFixed(1)}KB)`);
    });
} else {
    console.log('❌ Sample schemas directory not found');
}

// Test if we can parse the Petstore schema
console.log('\n📋 Testing Petstore schema parsing...');
const petstoreFile = path.join(sampleDir, 'petstore-api.json');

if (fs.existsSync(petstoreFile)) {
    try {
        const schema = JSON.parse(fs.readFileSync(petstoreFile, 'utf8'));
        console.log(`✅ Petstore schema parsed successfully!`);
        console.log(`   - Title: ${schema.info?.title || 'Unknown'}`);
        console.log(`   - Version: ${schema.info?.version || 'Unknown'}`);
        console.log(`   - Paths: ${Object.keys(schema.paths || {}).length}`);
        
        // Count total endpoints
        let endpointCount = 0;
        if (schema.paths) {
            Object.values(schema.paths).forEach(path => {
                if (path) {
                    const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];
                    methods.forEach(method => {
                        if (path[method]) endpointCount++;
                    });
                }
            });
        }
        console.log(`   - Total Endpoints: ${endpointCount}`);
        
    } catch (error) {
        console.log(`❌ Failed to parse Petstore schema: ${error.message}`);
    }
} else {
    console.log('❌ Petstore schema file not found');
}

console.log('\n🚀 Ready to test in VS Code!');
console.log('\nTo test schema loading:');
console.log('1. Press F5 to start Extension Development Host');
console.log('2. In the new window, press Ctrl+Shift+P');
console.log('3. Type "API Helper: Add Environment" and create an environment');
console.log('4. Type "API Helper: Load Schema from File" and select petstore-api.json');
console.log('5. Check the "API Environments" tree view in Explorer panel');
