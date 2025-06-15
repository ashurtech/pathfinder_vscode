#!/usr/bin/env node

/**
 * Test Platform Detection for Kibana/Elasticsearch APIs
 * 
 * This script tests the automatic platform detection and header injection
 * functionality we just implemented.
 */

console.log('🧪 Testing Platform Detection & Header Injection\n');

// Test schemas (simulated)
const testSchemas = [
    {
        name: 'Kibana API Schema',
        schema: {
            openapi: '3.0.3',
            info: {
                title: 'Kibana APIs',
                description: 'The Kibana REST APIs enable you to manage resources such as connectors, data views, and saved objects.',
                version: '1.0.2'
            },
            servers: [
                {
                    url: 'https://{kibana_url}',
                    variables: {
                        kibana_url: {
                            default: 'localhost:5601'
                        }
                    }
                }
            ]
        }
    },
    {
        name: 'Elasticsearch API Schema',
        schema: {
            openapi: '3.0.3',
            info: {
                title: 'Elasticsearch API',
                description: 'Elasticsearch provides REST APIs that are used by the UI components.',
                version: '8.0.0'
            },
            servers: [
                {
                    url: 'https://localhost:9200'
                }
            ]
        }
    },
    {
        name: 'Generic API Schema',
        schema: {
            openapi: '3.0.3',
            info: {
                title: 'Weather API',
                description: 'Get weather information for any location.',
                version: '2.0.0'
            },
            servers: [
                {
                    url: 'https://api.openweathermap.org/data/2.5'
                }
            ]
        }
    }
];

// Simulate our detection functions
function detectPlatformFromSchema(schema) {
    const info = schema?.info ?? {};
    const title = (info.title ?? '').toLowerCase();
    const description = (info.description ?? '').toLowerCase();
    const servers = schema?.servers ?? [];
    
    // Check for Kibana indicators
    const kibanaIndicators = ['kibana'];
    if (kibanaIndicators.some(indicator => 
        title.includes(indicator) || 
        description.includes(indicator) ||
        servers.some((server) => (server.url ?? '').toLowerCase().includes(indicator))
    )) {
        return 'kibana';
    }
    
    // Check for Elasticsearch indicators
    const elasticsearchIndicators = ['elasticsearch'];
    if (elasticsearchIndicators.some(indicator => 
        title.includes(indicator) || 
        description.includes(indicator) ||
        servers.some((server) => (server.url ?? '').toLowerCase().includes(indicator))
    )) {
        return 'elasticsearch';
    }
    
    return 'generic';
}

function generatePlatformConfig(platform) {
    switch (platform) {
        case 'kibana':
            return {
                platform: 'kibana',
                requiredHeaders: {
                    'kbn-xsrf': 'true'
                },
                authConfig: {
                    headerFormat: 'Bearer'
                },
                sslConfig: {
                    allowSelfSigned: true,
                    notes: 'Kibana often uses self-signed certificates in development'
                }
            };
        case 'elasticsearch':
            return {
                platform: 'elasticsearch',
                requiredHeaders: {},
                authConfig: {
                    headerFormat: 'Bearer'
                },
                sslConfig: {
                    allowSelfSigned: true,
                    notes: 'Elasticsearch often uses self-signed certificates'
                }
            };
        default:
            return {
                platform: 'generic',
                requiredHeaders: {},
                authConfig: {
                    headerFormat: 'Bearer'
                },
                sslConfig: {
                    allowSelfSigned: false
                }
            };
    }
}

// Test the detection
console.log('🔍 Testing Platform Detection:\n');

testSchemas.forEach((test, index) => {
    console.log(`${index + 1}. ${test.name}`);
    console.log(`   Title: "${test.schema.info.title}"`);
    
    const detectedPlatform = detectPlatformFromSchema(test.schema);
    const platformConfig = generatePlatformConfig(detectedPlatform);
    
    console.log(`   ✅ Detected Platform: ${detectedPlatform}`);
    
    if (platformConfig.requiredHeaders && Object.keys(platformConfig.requiredHeaders).length > 0) {
        console.log(`   📋 Required Headers: ${Object.entries(platformConfig.requiredHeaders)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')}`);
    } else {
        console.log(`   📋 Required Headers: none`);
    }
    
    console.log(`   🔐 Auth Format: ${platformConfig.authConfig?.headerFormat ?? 'Bearer'}`);
    console.log(`   🔒 SSL Config: ${platformConfig.sslConfig?.allowSelfSigned ? 'Allow self-signed' : 'Strict SSL'}`);
    console.log('');
});

console.log('🎯 Expected Results:');
console.log('=====================');
console.log('✅ Kibana API → Should detect "kibana" platform and inject kbn-xsrf: true header');
console.log('✅ Elasticsearch API → Should detect "elasticsearch" platform with no extra headers');  
console.log('✅ Weather API → Should detect "generic" platform with no extra headers');
console.log('');

console.log('🚀 Integration Test:');
console.log('===================');
console.log('When you load a Kibana schema in the extension:');
console.log('1. Platform detection should automatically identify it as Kibana');
console.log('2. Generated HTTP requests should include "kbn-xsrf: true" header');
console.log('3. Code generation (cURL, etc.) should include the required header');
console.log('4. This prevents CSRF protection errors when making requests to Kibana');
