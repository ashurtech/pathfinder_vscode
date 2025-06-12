# HTTP Request Runner - Testing Guide

## 🧪 Quick Test Instructions

### Prerequisites
- Install VS Code Extension Development Host
- Load the `pathfinder-openapi-explorer-0.1.2.vsix` or run from source

### Test Scenario 1: Basic HTTP Runner Workflow

1. **Open Extension Development Host**
   ```bash
   code --extensionDevelopmentPath=. --disable-extensions
   ```

2. **Add Environment**
   - Command Palette: `Pathfinder: Add API Environment`
   - Name: `Petstore API`
   - Base URL: `https://petstore.swagger.io/v2`
   - Auth: None

3. **Load Schema**
   - In tree view, click environment's "Load Schema" button
   - URL: `https://petstore.swagger.io/v2/swagger.json`

4. **Test HTTP Request Generation**
   - Expand schema in tree view
   - Expand any endpoint (e.g., `/pet/{petId}`)
   - Click "🚀 Run HTTP Request"
   - **Expected**: HTTP file opens with generated request

5. **Test CodeLens**
   - In the opened HTTP file, look for "▶ Run Request" buttons
   - **Expected**: CodeLens buttons visible above each HTTP request

6. **Test Request Execution**
   - Click any "▶ Run Request" button
   - **Expected**: Request executes and response shows in new tab

### Test Scenario 2: HTTP File Language Support

1. **Create New HTTP File**
   - File → New File
   - Save as `test.http`

2. **Add Content**
   ```http
   ### Test Request
   GET https://petstore.swagger.io/v2/pet/1
   Content-Type: application/json
   
   ### Another Request
   POST https://petstore.swagger.io/v2/pet
   Content-Type: application/json
   
   {
     "name": "fluffy",
     "photoUrls": ["http://example.com/photo.jpg"]
   }
   ```

3. **Verify Language Features**
   - **Syntax highlighting**: Methods, URLs, headers should be colored
   - **Code folding**: ### sections should be foldable
   - **CodeLens**: "▶ Run Request" buttons should appear

### Test Scenario 3: Error Handling

1. **Invalid Request**
   ```http
   INVALID https://invalid-url
   ```
   - **Expected**: Graceful error message

2. **Network Error**
   ```http
   GET https://nonexistent-domain-12345.com/api
   ```
   - **Expected**: Network error handled gracefully

### Test Scenario 4: Environment Integration

1. **Different Environments**
   - Create multiple environments
   - Generate HTTP requests from each
   - **Expected**: Requests use correct base URLs

2. **Authentication Headers**
   - Set API key in environment
   - Generate HTTP request
   - **Expected**: Auth headers included automatically

## 🔍 Verification Checklist

### ✅ Core Functionality
- [ ] Tree view shows "🚀 Run HTTP Request" action
- [ ] HTTP files generate with proper format
- [ ] CodeLens appears in HTTP files
- [ ] Requests execute successfully
- [ ] Responses display in new tabs

### ✅ Language Support
- [ ] .http and .rest files recognized
- [ ] Syntax highlighting works
- [ ] Code folding works with ###
- [ ] Auto-completion suggestions appear

### ✅ Integration
- [ ] Environment URLs included in requests
- [ ] Authentication headers added automatically
- [ ] Tree view integration seamless
- [ ] No conflicts with existing features

### ✅ Error Handling
- [ ] Invalid requests show clear errors
- [ ] Network errors handled gracefully
- [ ] Missing environments handled properly
- [ ] Extension doesn't crash on errors

## 🚀 Advanced Testing

### Performance Test
1. Load large OpenAPI schema (100+ endpoints)
2. Generate multiple HTTP requests
3. **Expected**: No performance degradation

### Memory Test
1. Open/close multiple HTTP files
2. Execute many requests
3. **Expected**: No memory leaks

### Concurrent Test
1. Execute multiple requests simultaneously
2. **Expected**: All requests complete successfully

## 🛠️ Debugging Tips

### Enable Developer Tools
- Help → Toggle Developer Tools
- Check Console for errors

### Extension Logs
- Output Panel → Pathfinder - OpenAPI Explorer
- Check for HTTP Runner related logs

### Manual Command Testing
```javascript
// Test HTTP request generation command
vscode.commands.executeCommand('pathfinder.runHttpRequest', endpoint, schemaItem);

// Test HTTP request execution command  
vscode.commands.executeCommand('pathfinder.executeHttpRequest', documentUri, lineNumber);
```

## 📊 Success Criteria

### Minimum Viable Testing
- [ ] Can generate HTTP request from endpoint
- [ ] CodeLens appears and is clickable
- [ ] Request executes and shows response

### Complete Feature Testing
- [ ] All test scenarios pass
- [ ] No compilation errors
- [ ] No runtime errors in normal usage
- [ ] Professional user experience

## 🎯 Expected Results

After successful testing, users should be able to:

1. **Explore APIs visually** in the tree view
2. **Generate executable HTTP requests** with one click
3. **Execute requests directly in VS Code** with CodeLens
4. **View formatted responses** immediately
5. **Work entirely within VS Code** for API testing

---

*Use this guide to validate the HTTP Request Runner feature implementation*
