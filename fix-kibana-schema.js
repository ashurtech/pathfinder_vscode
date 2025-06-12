#!/usr/bin/env node

/**
 * Fix Kibana OpenAPI Schema Validation Errors
 * 
 * This script fixes the specific validation errors found in the Kibana schema:
 * 1. run_message_email: object in required array should be string
 * 2. genai_secrets: empty required array should have at least 1 item
 * 3. Synthetics_httpMonitorFields: "additionalproperties" should be "additionalProperties"
 * 4. Synthetics_getParameterResponse: null required field should be array
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_FILE = path.join(__dirname, 'sample-schemas', 'kibana-openapi-source.json');
const BACKUP_FILE = path.join(__dirname, 'sample-schemas', 'kibana-openapi-source.json.backup');

console.log('🔧 Fixing Kibana OpenAPI Schema Validation Errors');
console.log('📁 Schema file:', SCHEMA_FILE);

try {
    // Create backup
    console.log('💾 Creating backup...');
    fs.copyFileSync(SCHEMA_FILE, BACKUP_FILE);
    console.log('✅ Backup created:', BACKUP_FILE);

    // Read the schema
    console.log('📖 Reading schema...');
    const schemaContent = fs.readFileSync(SCHEMA_FILE, 'utf8');
    const schema = JSON.parse(schemaContent);

    let fixCount = 0;

    // Fix 1: run_message_email - required field has object instead of string
    console.log('🔧 Fix 1: Checking run_message_email schema...');
    if (schema.components?.schemas?.run_message_email?.required) {
        const required = schema.components.schemas.run_message_email.required;
        console.log('   Current required array:', required);
        
        // Find and fix any objects in the required array
        for (let i = 0; i < required.length; i++) {
            if (typeof required[i] === 'object' && required[i] !== null) {
                console.log(`   ❌ Found object at index ${i}:`, required[i]);
                // If it's an object with a single key, use that key as the string
                const keys = Object.keys(required[i]);
                if (keys.length === 1) {
                    required[i] = keys[0];
                    console.log(`   ✅ Fixed to string: "${required[i]}"`);
                    fixCount++;
                } else {
                    // Remove invalid object
                    required.splice(i, 1);
                    i--; // Adjust index
                    console.log('   ✅ Removed invalid object');
                    fixCount++;
                }
            }
        }
    }

    // Fix 2: genai_secrets - empty required array
    console.log('🔧 Fix 2: Checking genai_secrets schema...');
    if (schema.components?.schemas?.genai_secrets?.required) {
        const required = schema.components.schemas.genai_secrets.required;
        console.log('   Current required array length:', required.length);
        
        if (required.length === 0) {
            console.log('   ❌ Empty required array found');
            // Remove the required property entirely since it's empty
            delete schema.components.schemas.genai_secrets.required;
            console.log('   ✅ Removed empty required property');
            fixCount++;
        }
    }

    // Fix 3: Synthetics_httpMonitorFields - additionalproperties typo
    console.log('🔧 Fix 3: Checking Synthetics_httpMonitorFields schema...');
    if (schema.components?.schemas?.Synthetics_httpMonitorFields?.allOf) {
        const allOf = schema.components.schemas.Synthetics_httpMonitorFields.allOf;
        
        for (let i = 0; i < allOf.length; i++) {
            if (allOf[i].additionalproperties !== undefined) {
                console.log(`   ❌ Found "additionalproperties" typo in allOf[${i}]`);
                const value = allOf[i].additionalproperties;
                delete allOf[i].additionalproperties;
                allOf[i].additionalProperties = value;
                console.log(`   ✅ Fixed to "additionalProperties": ${value}`);
                fixCount++;
            }
        }
    }

    // Fix 4: Synthetics_getParameterResponse - null required field
    console.log('🔧 Fix 4: Checking Synthetics_getParameterResponse schema...');
    if (schema.components?.schemas?.Synthetics_getParameterResponse?.required !== undefined) {
        const required = schema.components.schemas.Synthetics_getParameterResponse.required;
        console.log('   Current required value:', required, 'Type:', typeof required);
        
        if (required === null) {
            console.log('   ❌ Found null required field');
            // Remove the required property since it's null
            delete schema.components.schemas.Synthetics_getParameterResponse.required;
            console.log('   ✅ Removed null required property');
            fixCount++;
        }
    }

    // Write the fixed schema
    if (fixCount > 0) {
        console.log(`📝 Writing fixed schema with ${fixCount} fixes...`);
        fs.writeFileSync(SCHEMA_FILE, JSON.stringify(schema, null, 2));
        console.log('✅ Schema fixed and saved!');
    } else {
        console.log('ℹ️  No fixes needed - schema already valid');
    }

    console.log(`\n🎉 Summary:`);
    console.log(`   Applied ${fixCount} fixes`);
    console.log(`   Original file: ${SCHEMA_FILE}`);
    console.log(`   Backup file: ${BACKUP_FILE}`);

} catch (error) {
    console.error('❌ Error fixing schema:', error.message);
    console.error(error.stack);
    process.exit(1);
}
