/**
 * Test to reproduce the specific HTTP parsing bug with authorization headers
 * Issue: "FOR data" appearing when authorization headers have toggle visibility comments
 */

console.log('🐛 Testing HTTP Request Parsing Bug with Auth Headers...');

// Test case that might trigger the "FOR data" bug - with authorization headers containing comments
const problematicHttpContent = `### Test Request
# Environment: Test Environment
# Description: Testing request with auth

GET https://httpbin.org/bearer
Authorization: Bearer abcd**** # 👁️ Click to toggle visibility
Content-Type: application/json

{
  "test": "data"
}`;

console.log('📝 Problematic HTTP Content:');
console.log(problematicHttpContent);

// Simulate the current parsing logic
console.log('\n🔍 Testing current parsing logic...');

const lines = problematicHttpContent.split('\n').filter(line => !line.trim().startsWith('#') && line.trim());

console.log('\n📊 Filtered lines:');
lines.forEach((line, index) => {
    console.log(`${index}: "${line}"`);
});

console.log('\n🔍 Parsing request line...');
if (lines.length > 0) {
    const requestLine = lines[0].trim();
    console.log(`Request line: "${requestLine}"`);
    
    const [method, fullUrl] = requestLine.split(' ', 2);
    console.log(`Parsed method: "${method}"`);
    console.log(`Parsed URL: "${fullUrl}"`);
    
    if (method === 'GET' && fullUrl && fullUrl.startsWith('http')) {
        console.log('✅ This case parsed correctly');
    } else {
        console.log('❌ Parsing failed!');
    }
}

// Test with a more complex case that might show the issue
const complexCase = `### List all pets
# Environment: Petstore API
# Description: Returns a list of pets

GET https://petstore.swagger.io/v2/pet/findByStatus?status=<REQUIRED>
Content-Type: application/json
Accept: application/json
Authorization: Bearer abcd**** # 👁️ Click to toggle visibility

### Path Parameters
# No path parameters

### Notes
# - Fill in the placeholders marked with < >
# - Remove optional parameters if not needed
# - Click the "▶ Run Request" button to execute
`;

console.log('\n\n🔍 Testing complex case...');
console.log('📝 Complex case content preview:');
console.log(complexCase.substring(0, 200) + '...');

const complexLines = complexCase.split('\n').filter(line => !line.trim().startsWith('#') && line.trim());

console.log('\n📊 Complex filtered lines:');
complexLines.forEach((line, index) => {
    console.log(`${index}: "${line}"`);
});

if (complexLines.length > 0) {
    const complexRequestLine = complexLines[0].trim();
    console.log(`\nComplex request line: "${complexRequestLine}"`);
    
    const [complexMethod, complexFullUrl] = complexRequestLine.split(' ', 2);
    console.log(`Complex parsed method: "${complexMethod}"`);
    console.log(`Complex parsed URL: "${complexFullUrl}"`);
    
    if (complexMethod === 'GET' && complexFullUrl && complexFullUrl.startsWith('http')) {
        console.log('✅ Complex case parsed correctly');
    } else if (complexMethod === 'FOR') {
        console.log('❌ BUG REPRODUCED: Found "FOR" instead of "GET"!');
    } else {
        console.log('❌ Complex case parsing failed with unexpected result');
    }
}

console.log('\n💡 If the bug is still not reproduced, it might be:');
console.log('1. Related to how masked headers are processed during execution');
console.log('2. An issue with the CodeLens provider determining line numbers');
console.log('3. A race condition between masking/unmasking and parsing');
console.log('4. The issue happens only in the VS Code extension context');
