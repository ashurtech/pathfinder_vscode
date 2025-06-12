// Demo test script for API Helper Extension
// This script simulates testing the extension's core functionality

console.log("🚀 API Helper Extension Demo Test");
console.log("==================================");

// Test data for demonstration
const testEnvironments = [
    {
        name: "Swagger Petstore",
        baseUrl: "https://petstore.swagger.io/v2",
        schemaUrl: "https://petstore.swagger.io/v2/swagger.json",
        auth: { type: "none" }
    },
    {
        name: "JSONPlaceholder",
        baseUrl: "https://jsonplaceholder.typicode.com",
        schemaUrl: "https://jsonplaceholder.typicode.com/", // Mock URL for demo
        auth: { type: "none" }
    },
    {
        name: "Local Kibana",
        baseUrl: "http://localhost:5601",
        schemaUrl: "file://./sample-schemas/kibana-openapi-source.json",
        auth: { type: "basic", username: "elastic", password: "changeme" }
    }
];

console.log("\n📊 Test Environments:");
testEnvironments.forEach((env, index) => {
    console.log(`${index + 1}. ${env.name}`);
    console.log(`   Base URL: ${env.baseUrl}`);
    console.log(`   Schema: ${env.schemaUrl}`);
    console.log(`   Auth: ${env.auth.type}`);
    console.log("");
});

console.log("✅ Demo data prepared for testing!");
console.log("\n📝 Next Steps:");
console.log("1. Open VS Code in this directory");
console.log("2. Press F5 to launch Extension Development Host");
console.log("3. Use Command Palette (Ctrl+Shift+P) to test commands");
console.log("4. Check Explorer panel for 'API Environments' tree view");
console.log("\n🎯 Key Commands to Test:");
console.log("- API Helper: Add Environment");
console.log("- API Helper: Load Schema from URL");
console.log("- API Helper: Load Schema from File");
console.log("- API Helper: List Environments");
