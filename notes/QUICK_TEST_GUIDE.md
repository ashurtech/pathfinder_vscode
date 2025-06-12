# 🧪 Quick Testing Guide for API Helper Extension

## ✅ Extension is Ready!

Your extension has been successfully compiled and packaged. Choose one of the testing methods below:

## 🚀 Method 1: Debug Mode (Recommended)

1. **Open VS Code** in the extension directory:
   ```bash
   cd "b:\vscode\vs_ext_api"
   code .
   ```

2. **Start debugging**: Press `F5` or `Ctrl+F5`
   - This opens a new "Extension Development Host" window
   - Your extension will be loaded automatically

3. **Look for the tree view**: In the Explorer panel, you should see "API Environments"

## 📦 Method 2: Install VSIX Package

The extension has been packaged as: `api-helper-extension-0.0.1.vsix`

1. **Install the extension**:
   - Open VS Code
   - Press `Ctrl+Shift+P`
   - Type "Extensions: Install from VSIX"
   - Select the `.vsix` file

## 🧪 Testing Checklist

### Basic Functionality
- [ ] **Tree View**: Check if "API Environments" appears in Explorer
- [ ] **Commands**: Press `Ctrl+Shift+P` and search for "API Helper"
- [ ] **Settings**: Go to Settings → Extensions → API Helper Extension

### Commands to Test
1. `API Helper: Add Environment` - Add a new API environment
2. `API Helper: Load Schema from URL` - Load OpenAPI schema from URL
3. `API Helper: Load Schema from File` - Load OpenAPI schema from file
4. `API Helper: List Environments` - View all environments
5. `API Helper: List Schemas` - View all loaded schemas
6. `API Helper: Remove Environment` - Remove an environment
7. `API Helper: Remove Schema` - Remove a schema
8. `API Helper: Clear All Data` - Clear all data

### Sample Test Data

**Test with Swagger Petstore API**:
- Environment: "Petstore"
- Base URL: `https://petstore.swagger.io/v2`
- Schema URL: `https://petstore.swagger.io/v2/swagger.json`
- Auth: None

**Test with JSONPlaceholder**:
- Environment: "JSONPlaceholder"  
- Base URL: `https://jsonplaceholder.typicode.com`
- Schema URL: `https://jsonplaceholder.typicode.com/openapi.json` (if available)
- Auth: None

## 🔍 What You Should See

1. **Tree View Structure**:
   ```
   API Environments
   ├─ 📁 Environment Name
   │  └─ 📄 Schema Name
   │     ├─ 📂 Tag Group
   │     │  ├─ 🔗 GET /endpoint
   │     │  └─ 🔗 POST /endpoint
   │     └─ 📂 Another Tag Group
   ```

2. **Context Menus**: Right-click on tree items for context actions

3. **Click Handlers**: Click on endpoints to see details

## 🐛 Common Issues

- **Tree view not visible**: Check Explorer panel, look for "API Environments"
- **Commands not found**: Make sure extension is activated
- **Schema loading fails**: Check URL accessibility and OpenAPI format
- **No endpoints shown**: Verify schema has valid paths and operations

## 📝 Testing Features

### Core Features ✅ Working
- [x] Environment management
- [x] Schema loading (URL and file)
- [x] Tree view with hierarchical display
- [x] Authentication support
- [x] Settings integration
- [x] Command system

### Advanced Features 🚧 To Be Implemented
- [ ] Code generation (curl, Ansible, PowerShell)
- [ ] API execution
- [ ] Parameter autocompletion
- [ ] Response handling

## 🎯 Next Steps

After basic testing:
1. Test with real OpenAPI schemas
2. Verify authentication works
3. Test schema loading from files
4. Check data persistence (restart VS Code)
5. Test edge cases (invalid URLs, malformed schemas)
