#!/usr/bin/env node

/**
 * Locate and examine the specific problem in Synthetics_httpMonitorFields
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_FILE = path.join(__dirname, 'sample-schemas', 'kibana-openapi-source.json');

console.log('🔍 Examining Synthetics_httpMonitorFields schema section');

try {
    const schemaContent = fs.readFileSync(SCHEMA_FILE, 'utf8');
    const schema = JSON.parse(schemaContent);

    const targetSchema = schema.components?.schemas?.Synthetics_httpMonitorFields;
    
    if (targetSchema) {
        console.log('📋 Found Synthetics_httpMonitorFields schema:');
        console.log(JSON.stringify(targetSchema, null, 2));
        
        // Look specifically at allOf[1]
        if (targetSchema.allOf && targetSchema.allOf[1]) {
            console.log('\n🎯 Examining allOf[1]:');
            console.log(JSON.stringify(targetSchema.allOf[1], null, 2));
            
            // Look at properties.check
            if (targetSchema.allOf[1].properties?.check) {
                console.log('\n🔎 Found properties.check:');
                console.log(JSON.stringify(targetSchema.allOf[1].properties.check, null, 2));
            }
        }
    } else {
        console.log('❌ Synthetics_httpMonitorFields schema not found');
    }

} catch (error) {
    console.error('❌ Error examining schema:', error.message);
}
