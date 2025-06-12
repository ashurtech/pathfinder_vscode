#!/usr/bin/env node

/**
 * Enhanced Fix for Kibana OpenAPI Schema Validation Errors
 * 
 * This script fixes additional validation errors found in the Kibana schema:
 * - Invalid enum value "objects" should be "object" in type fields
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_FILE = path.join(__dirname, 'sample-schemas', 'kibana-openapi-source.json');

console.log('🔧 Enhanced Fix for Kibana OpenAPI Schema Validation Errors');
console.log('📁 Schema file:', SCHEMA_FILE);

try {
    // Read the schema
    console.log('📖 Reading schema...');
    const schemaContent = fs.readFileSync(SCHEMA_FILE, 'utf8');
    const schema = JSON.parse(schemaContent);

    let fixCount = 0;

    // Recursive function to fix type enum values
    function fixTypeEnums(obj, path = '') {
        if (typeof obj !== 'object' || obj === null) return;

        for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key;
            
            // Check if this is a type field with invalid enum value
            if (key === 'type' && value === 'objects') {
                console.log(`   ❌ Found invalid type enum "objects" at ${currentPath}`);
                obj[key] = 'object';
                console.log(`   ✅ Fixed to "object"`);
                fixCount++;
            }
            
            // Recursively check nested objects and arrays
            if (typeof value === 'object') {
                if (Array.isArray(value)) {
                    value.forEach((item, index) => {
                        fixTypeEnums(item, `${currentPath}[${index}]`);
                    });
                } else {
                    fixTypeEnums(value, currentPath);
                }
            }
        }
    }

    console.log('🔧 Scanning for invalid type enum values...');
    fixTypeEnums(schema);

    // Write the fixed schema
    if (fixCount > 0) {
        console.log(`📝 Writing enhanced fix with ${fixCount} additional fixes...`);
        fs.writeFileSync(SCHEMA_FILE, JSON.stringify(schema, null, 2));
        console.log('✅ Schema enhanced fixes applied!');
    } else {
        console.log('ℹ️  No additional fixes needed');
    }

    console.log(`\n🎉 Enhanced Fix Summary:`);
    console.log(`   Applied ${fixCount} additional fixes`);
    console.log(`   Fixed invalid "objects" type enums to "object"`);

} catch (error) {
    console.error('❌ Error applying enhanced fixes:', error.message);
    console.error(error.stack);
    process.exit(1);
}
