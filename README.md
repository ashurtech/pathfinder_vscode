# API Helper Extension

A VS Code extension to assist developers working with REST APIs that provide OpenAPI (Swagger) schemas. This project serves as both a useful tool and an educational resource for learning VS Code extension development.

As a model use-case, I personally would like to be able to load the openapi schema for Kibana, then in a ui element browse through the available api commands.
I work with a number of different Kibana instances so I'd like to be able to setup a number of APi environments, with a base API url (https://kibana.apac-test-1.sand.wtg.zone,https://kibana.emea-test-1.sand.wtg.zone etc), each with their own credentials or API key. Then when browsing through the commands have an option to generate a command with the example body (if any) in an editor window.
In the editor window we should be able to have autocompletion for the valid parameters and basic type checking.
It would be especially cool if we can choose to generate the command in differint formats (curl, Ansible uri, Powershell, maybe others if do-able.)
As a sort of bonus goal it would be even better if we could execute the command and return the results in vscode also,, but this is a nice to have.

## 🎯 Purpose

This extension helps developers:
- Load and validate OpenAPI/Swagger specifications
- Generate TypeScript interfaces from API schemas
- Test API endpoints directly from VS Code
- Browse API documentation within the editor
- Generate client code snippets

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
api-helper-extension/
├── src/                          # Source TypeScript files
│   ├── extension.ts              # Main extension entry point
│   └── test/
│       └── extension.test.ts     # Unit tests
├── dist/                         # Compiled JavaScript output
├── node_modules/                 # Installed dependencies
├── package.json                  # Project manifest and dependencies
├── tsconfig.json                 # TypeScript compiler configuration
├── eslint.config.mjs             # ESLint code quality rules
├── esbuild.js                    # Build tool configuration
└── AGENT_INSTRUCTIONS.md         # Development progress tracker
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
   - Type "API Helper" to see available commands

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

Once installed, the extension provides these commands (accessible via `Ctrl+Shift+P`):

- **Hello World**: Simple test command
- **Load OpenAPI Schema**: Parse an OpenAPI specification file
- **Validate Schema**: Check if an OpenAPI schema is valid
- **Generate API Client**: Create TypeScript code for API calls

## 🤝 Contributing

This is an educational project! Contributions that help with learning are welcome:
- Add more detailed comments
- Improve error handling examples
- Add new features with educational value
- Enhance documentation

## 📝 License

MIT License - feel e to use this code for learning and building your own extensions.

## 🔗 Useful Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Node.js Documentation](https://nodejs.org/docs/)
