# Pathfinder - OpenAPI Explorer

A VS Code extension that acts as your compass for navigating REST APIs with OpenAPI (Swagger) specifications. Pathfinder helps developers explore, test, and generate code for APIs with intelligent platform detection and environment management.

Originally designed to streamline work with Kibana APIs across multiple environments, Pathfinder has evolved into a comprehensive OpenAPI exploration tool that adapts to your workflow.

Works well with these openai api's;

Kibana - https://www.elastic.co/docs/api/doc/kibana.json 
& 
Elasticsearch - https://www.elastic.co/docs/api/doc/elasticsearch.json

## 🧭 What Makes Pathfinder Special

Pathfinder goes beyond simple API browsing by providing:
- **Smart Platform Detection**: Automatically detects Kibana, Elasticsearch, and other API platforms
- **Multi-Environment Support**: Manage multiple API environments with different base URLs and credentials
- **Intelligent Code Generation**: Generate requests in multiple formats (cURL, Ansible, PowerShell, and more)
- **In-Editor Testing**: Execute API calls and view results directly in VS Code
- **Auto-completion**: IntelliSense for API parameters with type checking
- **Schema Validation**: Load and validate OpenAPI/Swagger specifications

## 🎯 Use Cases

This extension helps developers:
- **Explore APIs**: Browse through API endpoints with rich documentation
- **Multi-Environment Management**: Work with multiple Kibana/API instances seamlessly
- **Generate Code**: Create ready-to-use code snippets in various formats
- **Test Endpoints**: Execute API calls without leaving your editor
- **Validate Schemas**: Ensure OpenAPI specifications are correct
- **Learn APIs**: Understand API structures through interactive exploration

## 🎓 Educational Goals

This project is designed as a learning experience for developers who:
- Know JavaScript basics but are new to TypeScript
- Want to learn VS Code extension development
- Are interested in working with REST APIs and OpenAPI specs
- Want to understand modern development tooling (esbuild, ESLint, etc.)

## 🛠️ Technology Stack

### Core Technologies
- **TypeScript**: JavaScript with static type checking
- **VS Code Extension API**: The interface for extending VS Code
- **Node.js**: JavaScript runtime for the extension backend

### Key Libraries
- **axios**: Promise-based HTTP client for API requests
- **swagger-parser**: Validates and dereferences OpenAPI specifications
- **openapi-types**: TypeScript type definitions for OpenAPI

### Development Tools
- **esbuild**: Fast JavaScript bundler and minifier
- **ESLint**: Code linting and style enforcement
- **Mocha**: JavaScript testing framework
- **npm-run-all**: Run multiple npm scripts in parallel

## 📁 Project Structure

```
pathfinder-openapi-explorer/
├── src/                          # Source TypeScript files
│   ├── extension.ts              # Main extension entry point
│   ├── tree-provider.ts          # API explorer tree view
│   ├── tree-commands.ts          # Tree interaction commands
│   ├── configuration.ts          # Settings management
│   └── test/
│       └── extension.test.ts     # Unit tests
├── dist/                         # Compiled JavaScript output
├── node_modules/                 # Installed dependencies
├── package.json                  # Project manifest and dependencies
├── tsconfig.json                 # TypeScript compiler configuration
├── eslint.config.mjs             # ESLint code quality rules
├── esbuild.js                    # Build tool configuration
└── README.md                     # Project documentation
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- VS Code
- Basic knowledge of JavaScript

### Development Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Compile the extension**:
   ```bash
   npm run compile
   ```

3. **Run tests**:
   ```bash
   npm test
   ```

4. **Start development mode**:
   ```bash
   npm run watch
   ```

5. **Test the extension**:
   - Press `F5` in VS Code to open a new Extension Development Host window
   - In the new window, press `Ctrl+Shift+P` to open the command palette
   - Type "Pathfinder" to see available commands

## 📚 Key Concepts Explained

### VS Code Extension Basics

**Extension Entry Point**: The `extension.ts` file exports two main functions:
- `activate()`: Called when the extension starts up
- `deactivate()`: Called when the extension shuts down

**Commands**: Actions users can trigger through the Command Palette or keyboard shortcuts. Defined in `package.json` and implemented in code.

**Activation Events**: Conditions that cause VS Code to load your extension (e.g., opening certain file types).

### TypeScript for JavaScript Developers

**Type Annotations**: Add types to variables and functions for better error catching:
```typescript
const message: string = "Hello World";
function greet(name: string): string {
    return `Hello, ${name}!`;
}
```

**Interfaces**: Define the shape of objects:
```typescript
interface ApiEndpoint {
    path: string;
    method: string;
    description?: string; // Optional property
}
```

**Async/Await**: Handle asynchronous operations:
```typescript
async function loadSchema(url: string): Promise<any> {
    const response = await axios.get(url);
    return response.data;
}
```

## 🧪 Testing

Tests are written using the Mocha framework and run with:
```bash
npm test
```

Test files are located in `src/test/` and follow the pattern `*.test.ts`.

## 🔧 Build Process

The extension uses **esbuild** for fast compilation:
- `npm run compile`: One-time build
- `npm run watch`: Continuous compilation during development
- `npm run package`: Production build with optimization

## 📦 Available Commands

Once installed, Pathfinder provides these commands (accessible via `Ctrl+Shift+P`):

- **Pathfinder: Hello World**: Simple test command
- **Pathfinder: Add API Environment**: Add a new API environment configuration
- **Pathfinder: List API Environments**: View all configured API environments
- **Pathfinder: Delete API Environment**: Remove an API environment
- **Pathfinder: Load Schema from URL**: Parse an OpenAPI specification from a URL
- **Pathfinder: Load Schema from File**: Parse an OpenAPI specification from a local file
- **Pathfinder: Generate Client Code**: Create code snippets for API calls
- **Pathfinder: Test API Endpoint**: Execute API calls and view results
- **Pathfinder: Validate Schema**: Check if an OpenAPI schema is valid
- **Pathfinder: Refresh Explorer**: Refresh the API explorer tree view

## 🤝 Contributing

This is an educational project! Contributions that help with learning are welcome:
- Add more detailed comments
- Improve error handling examples
- Add new features with educational value
- Enhance documentation

## 📝 License

MIT License - feel free to use this code for learning and building your own extensions.

## 🔗 Useful Resources

- [VS Code Extension API Documentation](https://code.visualstudio.com/api)
- [OpenAPI Specification](https://swagger.io/specification/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Mocha Testing Framework](https://mochajs.org/)
- [ESBuild Documentation](https://esbuild.github.io/)

- [VS Code Extension API](https://code.visualstudio.com/api)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Node.js Documentation](https://nodejs.org/docs/)
