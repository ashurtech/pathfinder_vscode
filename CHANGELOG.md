# Change Log

All notable changes to the "api-helper-extension" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added

- Project structure and basic TypeScript setup
- Basic "Hello World" command for testing
- Development tooling (esbuild, ESLint, TypeScript)
- Sample OpenAPI schemas (Kibana, PetStore, Weather)
- **Core extension architecture with TypeScript interfaces**
- **Configuration manager for storing API environments and schemas**
- **OpenAPI schema loader with URL and file support**
- **Complete command system for environment and schema management**
- **🌳 Tree View for browsing API endpoints in Explorer panel**
- **Interactive tree items with click handlers and context menus**

### Implemented Commands

- `API Helper: Add API Environment` - Set up new API environments with authentication
- `API Helper: List API Environments` - View and select configured environments  
- `API Helper: Delete API Environment` - Remove unwanted environments
- `API Helper: Load Schema from URL` - Load OpenAPI schemas from remote URLs
- `API Helper: Load Schema from File` - Load OpenAPI schemas from local files
- `API Helper: Show Schema Information` - Display details about loaded schemas
- `API Helper: Show Storage Statistics` - Debug information about stored data
- **`API Helper: Refresh` - Refresh the tree view**
- **Tree item actions - Click environments, schemas, and endpoints for details**

### Tree View Features

- **📁 Environment nodes** - Show all configured API environments
- **📄 Schema nodes** - Display loaded OpenAPI schemas under each environment  
- **🏷️ Tag grouping** - Organize endpoints by OpenAPI tags
- **🔗 Endpoint nodes** - Individual API endpoints with HTTP method icons
- **📝 Click to view details** - Click any item to see detailed information
- **🔄 Auto-refresh** - Tree updates when environments/schemas change
- **⚡ Context menus** - Right-click actions for generating code

### Technical Implementation

- **TypeScript interfaces** for ApiEnvironment, LoadedSchema, ApiEndpoint, etc.
- **VS Code storage integration** using globalState for persistence
- **Authentication support** for API Key, Bearer Token, and Basic Auth
- **OpenAPI validation** using swagger-parser library
- **Error handling and user feedback** with progress indicators
- **Settings configuration** exposed in VS Code settings UI

### In Progress

- **✅ Tree view for browsing API endpoints - COMPLETED!**
- Code generation for different formats (curl, Ansible, PowerShell)
- API execution and response handling

### Configuration Settings

- `apiHelper.requestTimeout` - Default timeout for API requests (30000ms)
- `apiHelper.defaultCodeFormat` - Default format for generated code ('curl')
- `apiHelper.autoValidateSchemas` - Auto-validate schemas when loaded (true)
- `apiHelper.maxHistoryItems` - Maximum history items to keep (50)