# Change Log

All notable changes to the "Pathfinder - OpenAPI Explorer" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.2] - 2025-06-13 - HTTP Request Runner Feature

### 🚀 **HTTP Request Runner**

- **Generate HTTP requests from endpoints**: Click "🚀 Run HTTP Request" on any endpoint to create executable HTTP files
- **CodeLens integration**: "▶ Run Request" buttons appear in HTTP files for one-click execution
- **Direct request execution**: Execute HTTP requests within VS Code and view responses in new tabs
- **HTTP file language support**: Syntax highlighting, folding, and auto-completion for .http and .rest files
- **Professional request formatting**: Generated requests include proper headers, authentication, and parameter placeholders
- **Response display**: Formatted JSON responses with status codes and headers in dedicated output tabs

### 📝 **HTTP File Features**

- **Language configuration**: Full language support for HTTP request files
- **Syntax highlighting**: Comments, HTTP methods, URLs, headers, and JSON bodies
- **Code folding**: Organize multiple requests with ### separators
- **Auto-completion**: Smart suggestions for HTTP methods and common headers

### 🎯 **Enhanced Tree View Integration**

- **New endpoint action**: "🚀 Run HTTP Request" action added to all endpoint children in tree view
- **Seamless workflow**: From OpenAPI exploration to live testing in one click
- **Environment integration**: Generated requests automatically include environment URLs and authentication

### 🔧 **Technical Implementation**

- **HttpRequestRunner class**: Core engine for request parsing, execution, and response handling
- **HttpCodeLensProvider**: CodeLens provider for "▶ Run Request" buttons in HTTP editors
- **Command registration**: `pathfinder.runHttpRequest` and `pathfinder.executeHttpRequest` commands
- **Type-safe implementation**: Full TypeScript support with proper interfaces and error handling
- **Axios integration**: Robust HTTP client with timeout and error handling

### ✅ **HTTP Runner Quality Assurance**

- **Zero compilation errors**: Extension builds cleanly with new HTTP Runner features
- **Comprehensive testing**: Complete test suite for HTTP Runner workflow
- **Memory efficient**: Proper disposal of CodeLens providers and event handlers

## [0.1.1] - 2025-06-13 - User Experience Improvements

### 🎯 **Improved Schema Loading Experience**
- **Enhanced schema loading workflow**: Click "Load Schema" under environment now skips environment selection dialog
- **Direct environment targeting**: Schema loads directly into parent environment from tree view
- **Preserved command palette functionality**: Environment selection still available when using commands from palette
- **Backward compatibility maintained**: All existing functionality continues to work

### ⚠️ **Friendlier Validation Messages**
- **Changed error to warning**: Schema validation issues now show as warnings instead of aggressive error messages
- **Enhanced message content**: Include schema information (title, version, endpoint count) in validation messages
- **User-friendly language**: Changed from "Schema failed to load" to "Schema loaded with validation warnings"
- **Contextual information**: Users now understand the schema loaded successfully despite validation issues
- **Maintained functionality**: All extension features remain available even with validation warnings

### 🔧 **Technical Improvements**
- **Updated command handlers**: Added optional environment parameters to schema loading commands
- **Improved message formatting**: Better error summary with concise display for multiple validation issues
- **Code quality**: Used nullish coalescing operator (`??`) instead of logical OR (`||`) for better type safety

## [0.1.0] - 2024-12-20 - Major Rebrand: Pathfinder - OpenAPI Explorer

### 🚀 **Complete Rebranding**
- **Extension renamed** from "API Helper Extension" to "Pathfinder - OpenAPI Explorer"
- **All command IDs updated** from `api-helper-extension.*` to `pathfinder.*`
- **Tree view rebranded** from `apiHelperExplorer` to `pathfinderExplorer`
- **Configuration namespace** changed from `apiHelper.*` to `pathfinder.*`
- **Command categories** updated to "Pathfinder" throughout
- **Enhanced description** emphasizing exploration and platform detection
- **Updated keywords** for better discoverability (openapi, swagger, rest, api, testing, explorer, kibana, elasticsearch)

### 📦 **Package Improvements**
- **Version bumped** to 0.1.0 to reflect major rebrand
- **Publisher field** added for extension marketplace
- **Repository information** added to package.json
- **MIT License** added for open source compliance
- **Comprehensive README** updated with new branding and enhanced documentation

### 🧪 **Testing & Quality**
- **All tests updated** to reflect new command IDs and branding
- **Extension compiles cleanly** with new naming conventions
- **Successful packaging** with updated metadata
- **Maintained backward compatibility** for core functionality

## [0.0.2] - 2024-12-20 - Kibana Enhancement & Tree View Improvements

### 🎯 **Major UX Enhancement: Expandable Tree View**
- **Replaced immediate endpoint details** with expandable action menus
- **Endpoint nodes now expandable** (show ▶ collapsed arrow, expand to see actions)
- **Professional action menu** with 7 organized options per endpoint
- **Improved tree navigation** - no more overwhelming information on click

### 🔧 **Multi-Format Code Generation** 
- **Enhanced cURL generation** with proper line continuation and formatting
- **Ansible task creation** with comprehensive YAML structure
- **PowerShell scripts** with advanced error handling and SSL support
- **Python requests code** with proper exception handling
- **JavaScript fetch API** with modern Promise-based error handling
- **All formats now production-ready** with professional formatting

### 🚀 **Kibana-Specific Optimizations**
- **Automatic Kibana detection** based on environment name/URL containing "kibana"
- **`kbn-xsrf: true` header** automatically added across ALL formats for CSRF protection
- **Proper API key format**: `Authorization: ApiKey <key>` instead of custom headers
- **Enhanced PowerShell for Kibana**:
  - SSL certificate handling for self-signed certificates
  - Comprehensive error handling with response body capture
  - Kibana-specific comments and configuration

### 📋 **Endpoint Action Menu (7 Actions)**
Each endpoint now expands to show:
- **📋 View Full Details** - Complete endpoint documentation
- **💻 Generate cURL** - Command-line ready with Kibana headers
- **🔧 Generate Ansible** - Infrastructure automation with proper auth
- **⚡ Generate PowerShell** - Enhanced Windows scripting
- **🐍 Generate Python** - Modern requests library usage
- **📜 Generate JavaScript** - Fetch API with error handling
- **🧪 Test Endpoint** - Future live testing capability

### 🛠️ **Technical Improvements**
- **Reduced cognitive complexity** in PowerShell generation (refactored from 21 to <15)
- **Modular code structure** with separate functions for each concern
- **Enhanced error handling** across all generators
- **Environment detection logic** for platform-specific optimizations
- **Comprehensive TypeScript interfaces** for better type safety

### 🎨 **User Experience Enhancements**
- **Icons for each action type** making actions easily identifiable
- **Consistent formatting** across all generated code formats
- **Professional code output** with proper comments and documentation
- **Contextual help** with parameter suggestions from endpoint schemas
- **Clean tree structure** that scales well with large APIs

### ✅ **Quality Assurance**
- **Zero compilation errors** - extension builds cleanly
- **ESLint compliance** with modern TypeScript standards
- **Comprehensive testing** with detailed test guide
- **Production-ready code generation** for all supported formats

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
- **Endpoint action commands:**
  - **📋 View Full Details** - Complete endpoint information in markdown
  - **💻 Generate cURL** - Command-line HTTP requests
  - **🔧 Generate Ansible** - YAML automation tasks
  - **⚡ Generate PowerShell** - Windows PowerShell scripts  
  - **🐍 Generate Python** - Python requests library code
  - **📜 Generate JavaScript** - Modern fetch API code
  - **🧪 Test Endpoint** - Live API request testing

### Tree View Features

- **📁 Environment nodes** - Show all configured API environments
- **📄 Schema nodes** - Display loaded OpenAPI schemas under each environment  
- **🏷️ Tag grouping** - Organize endpoints by OpenAPI tags
- **🔗 Endpoint nodes** - Individual API endpoints with HTTP method icons (expandable)
- **📋 Endpoint actions** - Expand endpoints to reveal action options:
  - **📋 View Full Details** - Complete endpoint documentation
  - **💻 Generate cURL** - Command-line HTTP requests
  - **🔧 Generate Ansible** - Infrastructure automation tasks
  - **⚡ Generate PowerShell** - Windows scripting
  - **🐍 Generate Python** - Python requests code
  - **📜 Generate JavaScript** - Modern fetch API code
  - **🧪 Test Endpoint** - Execute live API requests
- **🔄 Auto-refresh** - Tree updates when environments/schemas change
- **⚡ Improved UX** - Click to expand, not overwhelm with information

### Technical Implementation

- **TypeScript interfaces** for ApiEnvironment, LoadedSchema, ApiEndpoint, etc.
- **VS Code storage integration** using globalState for persistence
- **Authentication support** for API Key, Bearer Token, and Basic Auth
- **OpenAPI validation** using swagger-parser library
- **Error handling and user feedback** with progress indicators
- **Settings configuration** exposed in VS Code settings UI

### In Progress

- **✅ Tree view for browsing API endpoints - COMPLETED!**
- **✅ Expandable endpoint actions with code generation - COMPLETED!**
- **✅ Multi-format code generation (cURL, Ansible, PowerShell, Python, JS) - COMPLETED!**
- **✅ Improved schema parsing with graceful error handling - COMPLETED!**
- API execution and response handling
- Advanced endpoint testing features

### Configuration Settings

- `apiHelper.requestTimeout` - Default timeout for API requests (30000ms)
- `apiHelper.defaultCodeFormat` - Default format for generated code ('curl')
- `apiHelper.autoValidateSchemas` - Auto-validate schemas when loaded (true)
- `apiHelper.maxHistoryItems` - Maximum history items to keep (50)