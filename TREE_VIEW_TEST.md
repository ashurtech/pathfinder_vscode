# 🎯 Quick Tree View Test

## Steps to Test the Tree View

1. **Launch Extension Development Host**
   - Press `F5` in VS Code
   - New window opens with extension loaded

2. **Check Tree View in Explorer**
   - Look for "API Helper" section in Explorer panel (left sidebar)
   - Should show "No API environments configured" initially

3. **Add Environment via Tree**
   - Click the `+` button in the tree toolbar
   - Follow prompts to create a test environment

4. **Load a Schema**
   - Use `Ctrl+Shift+P` → "API Helper: Load Schema from File"
   - Select the test environment you created
   - Navigate to `sample-schemas/petstore-api.json`

5. **Explore Tree Structure**
   - Environment should appear with schema underneath
   - Expand schema to see endpoint groups
   - Click on different items to see details

6. **Test Context Menu**
   - Right-click on an endpoint
   - Select "Generate Code" to see curl command

## Expected Tree Structure

```
📁 API Helper
├── 🖥️ Test Environment
│   └── 📄 Swagger Petstore v1.0.6
│       ├── 🏷️ pet
│       │   ├── ⬇️ GET /pet/findByStatus
│       │   ├── ⬇️ GET /pet/findByTags
│       │   ├── ➕ POST /pet
│       │   └── 🔧 PUT /pet
│       ├── 🏷️ store
│       │   └── ⬇️ GET /store/inventory
│       └── 🏷️ user
│           ├── ➕ POST /user
│           └── ⬇️ GET /user/login
```

## What Should Work

- ✅ Tree view appears in Explorer
- ✅ Add environment button works
- ✅ Tree refreshes automatically
- ✅ Click handlers show details
- ✅ Context menus appear
- ✅ Icons show correctly
- ✅ Grouping by tags works

If any of these don't work, check the VS Code Developer Console (`Help` → `Toggle Developer Tools`) for error messages.
