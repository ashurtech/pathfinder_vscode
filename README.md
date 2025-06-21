# Pathfinder - OpenAPI Explorer

A VS Code extension for exploring, testing, and generating code from OpenAPI/Swagger specifications. Pathfinder uses a schema-first approach to help you manage multiple API environments with authentication inheritance.

## Quick Start

1. **Add an API Schema**: Load an OpenAPI specification from URL or file
2. **Create Environment Groups**: Organize related environments (dev, test, prod)
3. **Add Environments**: Configure specific API instances with authentication
4. **Browse & Test**: Explore endpoints and generate HTTP requests

## Core Concepts

### Schemas
The foundation of Pathfinder. A **schema** contains:
- OpenAPI/Swagger specification
- Base configuration (headers, timeouts)
- Platform detection (Kibana, Elasticsearch, etc.)

### Environment Groups
Organize related environments under a schema. **Environment groups** provide:
- Shared authentication settings
- Logical organization (e.g., "Development", "Production")
- Authentication inheritance to environments

### Environments
Specific API instances within a group. **Environments** inherit:
- Authentication from their environment group (if configured)
- Base headers from the parent schema
- Platform-specific settings

**Authentication Inheritance Chain**: Schema defaults → Environment Group auth → Environment auth

## Getting Started

### 1. Adding Your First Schema

**From URL:**
1. Open Command Palette (`Ctrl+Shift+P`)
2. Run "Pathfinder: Load Schema from URL"
3. Enter the OpenAPI specification URL
4. Give your schema a name

**From File:**
1. Open Command Palette (`Ctrl+Shift+P`)
2. Run "Pathfinder: Load Schema from File"
3. Select your OpenAPI `.json` or `.yaml` file
4. Give your schema a name

**Example URLs:**
- Kibana: `https://www.elastic.co/docs/api/doc/kibana.json`
- Elasticsearch: `https://www.elastic.co/docs/api/doc/elasticsearch.json`

### 2. Creating Environment Groups

Environment groups help organize related environments and provide shared authentication.

**Via Tree View:**
1. Right-click on a schema in the Pathfinder Explorer
2. Select "Add Environment Group"
3. Fill out the form:
   - **Name**: Descriptive name (e.g., "Development", "Production")
   - **Description**: Optional details
   - **Authentication**: Set shared auth for all environments in this group

**Authentication Options:**
- **None**: No authentication
- **API Key**: Header or query parameter based
- **Bearer Token**: Authorization header with token
- **Basic Auth**: Username/password authentication

**Via Command:**
1. Open Command Palette (`Ctrl+Shift+P`)
2. Run "Pathfinder: Add Environment Group"
3. Select target schema
4. Configure group settings

### 3. Adding Environments

Environments represent specific API instances (dev server, production, etc.).

**Via Tree View:**
1. Right-click on an environment group
2. Select "Add Environment to Group"
3. Configure:
   - **Name**: Environment identifier (e.g., "dev-server")
   - **Base URL**: Full API base URL (e.g., `https://api.dev.company.com`)
   - **Authentication**: Override group auth if needed

**Via Command:**
1. Open Command Palette (`Ctrl+Shift+P`)
2. Run "Pathfinder: Add API Environment"
3. Select target schema
4. Configure environment

**Authentication Inheritance:**
- If environment group has auth configured, environments inherit it automatically
- Individual environments can override group authentication
- Leave environment auth as "None" to use group authentication

### 4. Understanding the Tree Structure

The Pathfinder Explorer shows:

```
📋 Schema Name (v1.0)
├── 📁 Environment Group 1
│   ├── 🌐 dev-environment
│   └── 🌐 prod-environment
├── 📁 Environment Group 2
│   └── 🌐 test-environment
└── 📋 Endpoints
    ├── 📁 Tag Group 1
    │   ├── GET /api/users
    │   └── POST /api/users
    └── 📁 Tag Group 2
        └── GET /api/health
```

## Working with APIs

### Browsing Endpoints

1. **Expand Schema**: Click to show environment groups and endpoints
2. **Expand Endpoint Groups**: Endpoints are organized by OpenAPI tags
3. **View Endpoint Details**: Click any endpoint to see:
   - Parameters
   - Request/response schemas
   - Authentication requirements

### Testing Endpoints

**HTTP Request Files:**
1. Right-click any endpoint
2. Select "Open HTTP Request"
3. Edit the generated `.http` file
4. Click "Send Request" or use `Ctrl+Alt+R`

**Jupyter Notebooks:**
1. Right-click any endpoint
2. Select "Create Notebook"
3. Execute cells to test API calls
4. Modify requests and re-run

### Code Generation

Generate ready-to-use code for any endpoint:

1. Right-click an endpoint
2. Select "Generate Code"
3. Choose format:
   - **cURL**: Command-line requests
   - **JavaScript**: Fetch/axios requests
   - **Python**: requests library
   - **PowerShell**: Invoke-RestMethod
   - **Ansible**: uri module tasks

## Authentication Management

### Setting Up Authentication

**Environment Group Level (Recommended):**
1. Right-click environment group → "Edit Environment Group"
2. Configure authentication once
3. All environments in group inherit these settings

**Individual Environment Level:**
1. Right-click environment → "Edit Environment"
2. Override group authentication if needed

### Authentication Types

**API Key Authentication:**
- **Header**: `Authorization: ApiKey <your-key>`
- **Query Parameter**: `?api_key=<your-key>`
- Specify header/parameter name

**Bearer Token:**
- **Header**: `Authorization: Bearer <your-token>`

**Basic Authentication:**
- **Header**: `Authorization: Basic <base64(username:password)>`

**Platform-Specific:**
- **Kibana**: Automatically adds `kbn-xsrf: true` header
- **Elasticsearch**: Uses ApiKey format by default

### Credential Storage

Pathfinder securely stores credentials using VS Code's SecretStorage:
- Credentials never appear in settings files
- Encrypted storage managed by VS Code
- Credentials prompt when first needed

## Advanced Features

### Schema Management

**Updating Schemas:**
1. Right-click schema → "Manage Schema"
2. Update from URL or reload from file
3. Environments automatically use updated endpoints

**Schema Validation:**
- Automatic validation on load
- View validation errors in schema info
- Invalid schemas show warning indicators

**Platform Detection:**
- Auto-detects Kibana, Elasticsearch APIs
- Applies platform-specific defaults
- Adds required headers automatically

### Environment Management

**Duplicating Environments:**
1. Right-click environment → "Duplicate Environment"
2. Modify settings for new environment
3. Maintains authentication inheritance

**Environment Groups:**
- Color-code groups for visual organization
- Bulk authentication management
- Logical environment organization

### File Generation

**HTTP Files:**
Generated `.http` files include:
- Full URL with environment base URL
- Required headers (platform-specific)
- Authentication headers
- Example request body (for POST/PUT)
- Variable substitution support

**Notebook Files:**
Generated `.ipynb` files include:
- Markdown documentation cells
- HTTP request cells
- Variable definition cells
- Response processing examples

## Troubleshooting

### Common Issues

**Schema Won't Load:**
- Check URL accessibility
- Verify OpenAPI specification format
- Look for validation errors in output panel

**Authentication Not Working:**
- Verify credentials in SecretStorage
- Check authentication inheritance chain
- Confirm API key/token format requirements

**Endpoints Not Appearing:**
- Refresh schema (right-click → "Refresh")
- Check OpenAPI specification has valid paths
- Verify schema validation passed

### Getting Help

1. **View Schema Info**: Right-click schema → "Show Schema Information"
2. **Check Storage**: Command → "Pathfinder: Show Storage Statistics"
3. **Reset Data**: Command → "Pathfinder: Factory Reset" (removes all data)

## Supported Platforms

Pathfinder provides enhanced support for:

- **Kibana APIs**: Auto-adds CSRF headers, ApiKey format
- **Elasticsearch APIs**: ApiKey authentication, SSL handling
- **Generic OpenAPI**: Works with any valid specification

## File Formats

### HTTP Request Files (`.http`)
```http
### Get User List
GET {{baseUrl}}/api/users
Authorization: Bearer {{token}}
kbn-xsrf: true

### Create User
POST {{baseUrl}}/api/users
Content-Type: application/json
Authorization: Bearer {{token}}

{
  "name": "John Doe",
  "email": "john@example.com"
}
```

### Jupyter Notebooks (`.ipynb`)
- Interactive API exploration
- Step-by-step request building
- Response analysis and visualization
- Variable management

## Commands Reference

| Command | Description |
|---------|-------------|
| `Pathfinder: Add API Schema` | Load OpenAPI specification |
| `Pathfinder: Add Environment Group` | Create environment group |
| `Pathfinder: Add API Environment` | Create new environment |
| `Pathfinder: List API Environments` | View all environments |
| `Pathfinder: Load Schema from URL` | Load schema from URL |
| `Pathfinder: Load Schema from File` | Load schema from file |
| `Pathfinder: Show Schema Information` | View schema details |
| `Pathfinder: Show Storage Statistics` | View data usage |
| `Pathfinder: Factory Reset` | Clear all data |

## Context Menu Actions

**Schema Actions:**
- Add Environment Group
- Manage Schema
- Show Schema Information

**Environment Group Actions:**
- Add Environment to Group
- Edit Environment Group
- Delete Environment Group

**Environment Actions:**
- Edit Environment
- Duplicate Environment
- Delete Environment

**Endpoint Actions:**
- Open HTTP Request
- Create Notebook
- Generate Code
- Test Endpoint
