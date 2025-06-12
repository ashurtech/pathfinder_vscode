/**
 * Test to reproduce the HTTP parsing bug
 * Issue: "FOR data" appearing instead of proper HTTP method/URL
 */

console.log('🐛 Testing HTTP Request Parsing Bug...');

// Sample HTTP content that should be parsed correctly (exact format from generateRequestSkeleton)
const httpContent = `### List all pets
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

// Also test with a more complex case that might cause issues
const complexHttpContent = `### Update an existing pet
# Environment: Petstore API  
# Description: Update an existing pet by Id

PUT https://petstore.swagger.io/v2/pet
Content-Type: application/json
Accept: application/json
Authorization: Bearer abcd**** # 👁️ Click to toggle visibility

{
  // Add your request body here
  // Example: "name": "value"
}

### Path Parameters
# No path parameters

### Notes
# - Fill in the placeholders marked with < >
# - Remove optional parameters if not needed
# - Click the "▶ Run Request" button to execute
`;

console.log('📝 Original HTTP Content:');
console.log(httpContent);

// Simulate the parsing logic that has the bug
console.log('\n🔍 Analyzing parsing logic...');

// This is the current buggy filtering logic
const lines = httpContent.split('\n').filter(line => !line.trim().startsWith('#') && line.trim());

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
    
    if (method === 'FOR' || method === '###') {
        console.log('❌ BUG REPRODUCED: Wrong parsing detected!');
        console.log('The issue is that the parser is picking up the wrong line as the request line.');
    } else if (method && fullUrl && fullUrl.startsWith('http')) {
        console.log('✅ Parsing looks correct');
    } else {
        console.log('⚠️  Unexpected parsing result');
    }
} else {
    console.log('❌ No lines found after filtering');
}

// Test the complex case too
console.log('\n\n🔍 Testing complex HTTP content...');
console.log('📝 Complex HTTP Content:');
console.log(complexHttpContent);

const complexLines = complexHttpContent.split('\n').filter(line => !line.trim().startsWith('#') && line.trim());

console.log('\n📊 Complex Filtered lines:');
complexLines.forEach((line, index) => {
    console.log(`${index}: "${line}"`);
});

if (complexLines.length > 0) {
    const complexRequestLine = complexLines[0].trim();
    console.log(`\nComplex request line: "${complexRequestLine}"`);
    
    const [complexMethod, complexFullUrl] = complexRequestLine.split(' ', 2);
    console.log(`Complex parsed method: "${complexMethod}"`);
    console.log(`Complex parsed URL: "${complexFullUrl}"`);
    
    if (complexMethod === 'PUT' && complexFullUrl && complexFullUrl.startsWith('http')) {
        console.log('✅ Complex parsing looks correct');
    } else {
        console.log('❌ Complex parsing failed!');
    }
}

console.log('\n💡 SOLUTION NEEDED:');
console.log('The parseHttpRequest method needs to be more intelligent about finding the actual HTTP request line');
console.log('It should look for lines that match HTTP_METHOD + URL pattern, not just filter out comments');
