const { HttpRequestParser } = require('./out/src/notebook/http-request-parser');

const parser = new HttpRequestParser();

const httpText = `PUT https://api.example.com/users/123
Content-Type: application/json
Authorization: Bearer token123
X-Custom-Header: custom-value
Accept: application/json

{"name": "Updated Name"}`;

console.log('Input:');
console.log(JSON.stringify(httpText));
console.log('\nParsed result:');
try {
    const result = parser.parse(httpText);
    console.log('Headers:', result.headers);
    console.log('Body:', result.body);
} catch (error) {
    console.error('Error:', error.message);
}
