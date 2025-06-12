# 🧪 Testing the API Helper Extension

## Quick Test Guide

To test the extension we've built so far, follow these steps:

### 1. **Start the Extension Development Host**
1. Open this project in VS Code
2. Press `F5` to launch the Extension Development Host
3. A new VS Code window will open with our extension loaded

### 2. **Test Basic Functionality**
1. Press `Ctrl+Shift+P` to open the Command Palette
2. Type "API Helper" to see all our commands
3. Try the following commands in order:

#### Test Command: Hello World
- Run `API Helper: Hello World`
- Should show "Hello World from API Helper Extension!"

#### Test Storage Statistics
- Run `API Helper: Show Storage Statistics`  
- Should show storage stats (initially 0 environments, 0 schemas)

### 3. **Test Environment Management**

#### Add an API Environment
1. Run `API Helper: Add API Environment`
2. Enter name: `Test Kibana`
3. Enter URL: `https://example.com`
4. Select authentication: `API Key`
5. Enter API key: `test-key-123`
6. Select location: `Header`
7. Enter header name: `X-API-Key`
8. Should show success message

#### List Environments
1. Run `API Helper: List API Environments`
2. Should show your test environment
3. Select it to see details

#### Test Storage Again
1. Run `API Helper: Show Storage Statistics`
2. Should now show 1 environment, 0 schemas

### 4. **Test Tree View (NEW!)**

#### Explore the API Helper Tree View
1. Look in the **Explorer panel** (left sidebar)
2. Find the **"API Helper"** section
3. You should see:
   - "No API environments configured" message initially
   - Refresh button (🔄) and Add Environment button (+) in the toolbar

#### Test Tree Interactions
1. **Add an environment** using the + button in tree toolbar OR command palette
2. **Tree should refresh automatically** showing your new environment
3. **Click on the environment** to view details in a new document
4. **Load a schema** for the environment
5. **Tree should refresh** showing the schema under the environment
6. **Expand the schema** to see endpoint groups and individual endpoints
7. **Click on endpoints** to see detailed API documentation

#### Tree Structure You Should See:
```
📁 API Helper
├── 🖥️ Test Kibana (your environment)
│   └── 📄 Swagger Petstore v1.0.0 (your schema)
│       ├── 🏷️ pet (tag group)
│       │   ├── ⬇️ GET /pet/findByStatus
│       │   ├── ➕ POST /pet
│       │   └── 🗑️ DELETE /pet/{petId}
│       ├── 🏷️ store (tag group)
│       │   └── ⬇️ GET /store/inventory
│       └── ⬇️ GET /user/login (untagged endpoint)
```

#### Context Menu Testing
1. **Right-click on an endpoint** 
2. Should see "Generate Code" option
3. Click it to see a basic curl command generated

### 5. **Test Schema Loading**

#### Load from Sample File
1. Run `API Helper: Load Schema from File`
2. Select the test environment you created
3. Navigate to `sample-schemas/petstore-api.json`
4. Should show success with endpoint count

#### Check Schema Info
1. Run `API Helper: Show Schema Information`
2. Should show details about the PetStore API

#### Final Storage Check
1. Run `API Helper: Show Storage Statistics`
2. Should show 1 environment, 1 schema

### 5. **Test Cleanup**

#### Delete Environment
1. Run `API Helper: Delete API Environment`
2. Select your test environment
3. Confirm deletion
4. Should show deletion confirmation

## 🎯 What We've Built So Far

### ✅ **Completed Features**
- ✅ API Environment management (create, list, delete)
- ✅ Authentication support (API Key, Bearer, Basic)
- ✅ OpenAPI schema loading (URL and file)
- ✅ Schema validation and information display
- ✅ Persistent storage using VS Code's globalState
- ✅ User-friendly progress indicators
- ✅ Comprehensive error handling

### 🚧 **Next Steps**
- **Tree View**: Browse API endpoints in a tree structure
- **Code Generation**: Generate curl, Ansible, PowerShell commands
- **Request Execution**: Execute API calls and display responses
- **Parameter Autocompletion**: IntelliSense for API parameters

## 🛠️ **Architecture Overview**

### **Core Files**
- `src/types.ts` - TypeScript interfaces defining data structures
- `src/configuration.ts` - Manages storage and retrieval of environments/schemas
- `src/schema-loader.ts` - Handles OpenAPI schema loading and parsing
- `src/extension.ts` - Main extension entry point with all commands

### **Key Concepts**

#### **VS Code Extension Basics**
- **Commands**: Functions users can run via Command Palette (`Ctrl+Shift+P`)
- **Storage**: Uses `globalState` to persist data between sessions
- **Progress**: Shows loading indicators for long-running operations
- **Validation**: Input validation with user-friendly error messages

#### **TypeScript Benefits**
- **Type Safety**: Catch errors at compile time, not runtime
- **IntelliSense**: Auto-completion and parameter hints
- **Interfaces**: Define contracts for data structures
- **Async/Await**: Clean handling of asynchronous operations

#### **OpenAPI Integration**
- **swagger-parser**: Validates and parses OpenAPI specifications
- **Reference Resolution**: Handles `$ref` links in schemas
- **Multiple Formats**: Supports JSON and YAML schema files

## 🎓 **Learning Highlights**

### **TypeScript Concepts Demonstrated**
```typescript
// Interface definition - defines the "shape" of data
interface ApiEnvironment {
    id: string;
    name: string;
    baseUrl: string;
    auth: ApiAuthentication;
}

// Async/await pattern for handling asynchronous operations
async function loadSchema(url: string): Promise<LoadedSchema> {
    const response = await axios.get(url);
    return { schema: response.data, isValid: true };
}

// Type guards and optional chaining
if (environment.auth.type === 'apikey' && environment.auth.apiKey) {
    headers[environment.auth.apiKeyName ?? 'X-API-Key'] = environment.auth.apiKey;
}
```

### **VS Code Extension Patterns**
```typescript
// Command registration
const command = vscode.commands.registerCommand('extension.commandName', handler);
context.subscriptions.push(command);

// User input with validation
const url = await vscode.window.showInputBox({
    prompt: 'Enter URL',
    validateInput: (value) => {
        try { new URL(value); return null; } 
        catch { return 'Invalid URL'; }
    }
});

// Progress indication
await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Loading...'
}, async (progress) => {
    progress.report({ message: 'Processing...' });
    // Long-running operation here
});
```

This foundation gives us a solid base to build the more advanced features like tree views, code generation, and API execution! 🚀
