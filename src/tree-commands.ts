/**
 * Tree View Commands
 * 
 * These are the commands that get executed when users interact with the tree view.
 * Each tree item can have a command that runs when clicked, and context menu items.
 */

import * as vscode from 'vscode';
import { ApiEnvironment, LoadedSchema, ApiEndpoint } from './types';
import { SchemaLoader } from './schema-loader';

/**
 * Show detailed information about an environment when clicked in tree
 */
export async function showEnvironmentDetailsCommand(environment: ApiEnvironment) {
    const details = [
        `# ${environment.name}`,
        '',
        `**Base URL:** ${environment.baseUrl}`,
        `**Authentication:** ${environment.auth.type}`,
        `**Created:** ${environment.createdAt.toLocaleString()}`,
        environment.lastUsed ? `**Last Used:** ${environment.lastUsed.toLocaleString()}` : '**Never used**',
        '',
        environment.description ? `**Description:** ${environment.description}` : ''
    ].filter(line => line !== '').join('\n');
    
    // Show in a new untitled document with markdown highlighting
    const doc = await vscode.workspace.openTextDocument({
        content: details,
        language: 'markdown'
    });
    
    await vscode.window.showTextDocument(doc);
}

/**
 * Show detailed information about a schema when clicked in tree
 */
export async function showSchemaDetailsCommand(schema: LoadedSchema) {
    const schemaLoader = new SchemaLoader();
    const info = schemaLoader.getSchemaInfo(schema.schema);
    
    const details = [
        `# ${info.title} v${info.version}`,
        '',
        info.description ? `**Description:** ${info.description}` : '',
        `**Servers:** ${info.serverCount}`,
        `**Paths:** ${info.pathCount}`,
        `**Endpoints:** ${info.endpointCount}`,
        '',
        `**Source:** ${schema.source}`,
        `**Loaded:** ${schema.loadedAt.toLocaleString()}`,
        `**Valid:** ${schema.isValid ? '✅ Yes' : '❌ No'}`,
        '',
        schema.validationErrors && schema.validationErrors.length > 0 ? 
            `**Validation Errors:**\n${schema.validationErrors.map(err => `- ${err}`).join('\n')}` : ''
    ].filter(line => line !== '').join('\n');
    
    const doc = await vscode.workspace.openTextDocument({
        content: details,
        language: 'markdown'
    });
    
    await vscode.window.showTextDocument(doc);
}

/**
 * Show detailed information about an API endpoint when clicked in tree
 */
export async function showEndpointDetailsCommand(endpoint: ApiEndpoint, schemaItem: any) {
    const details = [
        `# ${endpoint.method} ${endpoint.path}`,
        '',
        endpoint.summary ? `**Summary:** ${endpoint.summary}` : '',
        endpoint.description ? `**Description:** ${endpoint.description}` : '',
        endpoint.operationId ? `**Operation ID:** ${endpoint.operationId}` : '',
        endpoint.tags && endpoint.tags.length > 0 ? `**Tags:** ${endpoint.tags.join(', ')}` : '',
        '',
        '## Parameters',
        endpoint.parameters && endpoint.parameters.length > 0 ? 
            endpoint.parameters.map(param => 
                `- **${param.name}** (${param.in}) ${param.required ? '*required*' : '*optional*'}: ${param.description || 'No description'}`
            ).join('\n') : 
            'No parameters',
        '',
        '## Request Body',
        endpoint.requestBody ? 
            '```json\n' + JSON.stringify(endpoint.requestBody, null, 2) + '\n```' : 
            'No request body',
        '',
        '## Responses',
        endpoint.responses ? 
            Object.entries(endpoint.responses).map(([code, response]) => 
                `- **${code}**: ${typeof response === 'object' ? JSON.stringify(response, null, 2) : response}`
            ).join('\n') : 
            'No response definitions'
    ].filter(line => line !== '').join('\n');
    
    const doc = await vscode.workspace.openTextDocument({
        content: details,
        language: 'markdown'
    });
    
    await vscode.window.showTextDocument(doc);
}

/**
 * Generate code for an endpoint with support for different formats
 */
export async function generateCodeForEndpointCommand(endpoint: ApiEndpoint, schemaItem: any, format: string = 'curl') {
    // Extract environment from schemaItem
    const environment = schemaItem.environment;
    
    let generatedCode: string;
    let language: string;
    let title: string;
    
    switch (format.toLowerCase()) {
        case 'curl':
            generatedCode = generateCurlCommand(endpoint, environment);
            language = 'shellscript';
            title = 'cURL Command';
            break;
        case 'ansible':
            generatedCode = generateAnsibleTask(endpoint, environment);
            language = 'yaml';
            title = 'Ansible Task';
            break;
        case 'powershell':
            generatedCode = generatePowerShellScript(endpoint, environment);
            language = 'powershell';
            title = 'PowerShell Script';
            break;
        case 'python':
            generatedCode = generatePythonCode(endpoint, environment);
            language = 'python';
            title = 'Python Code';
            break;
        case 'javascript':
            generatedCode = generateJavaScriptCode(endpoint, environment);
            language = 'javascript';
            title = 'JavaScript Code';
            break;
        default:
            generatedCode = generateCurlCommand(endpoint, environment);
            language = 'shellscript';
            title = 'cURL Command';
    }
    
    const doc = await vscode.workspace.openTextDocument({
        content: `# ${title} for ${endpoint.method} ${endpoint.path}\n\n${generatedCode}`,
        language: language
    });
    
    await vscode.window.showTextDocument(doc);
}

/**
 * Test an endpoint by making a real request
 */
export async function testEndpointCommand(endpoint: ApiEndpoint, schemaItem: any) {
    const environment = schemaItem.environment;
    
    // Show a simple dialog for now - we can expand this later
    const result = await vscode.window.showInformationMessage(
        `Test ${endpoint.method} ${endpoint.path}?`,
        { modal: true },
        'Test Now', 'Cancel'
    );
    
    if (result === 'Test Now') {
        vscode.window.showInformationMessage('Endpoint testing coming soon! 🚀');
        // TODO: Implement actual HTTP request testing
    }
}

/**
 * Generate cURL command for an endpoint
 */
function generateCurlCommand(endpoint: ApiEndpoint, environment: ApiEnvironment): string {
    const url = `${environment.baseUrl}${endpoint.path}`;
    let command = `curl -X ${endpoint.method} "${url}"`;
    
    // Add authentication headers
    if (environment.auth.type === 'bearer' && environment.auth.bearerToken) {
        command += ` \\\n  -H "Authorization: Bearer ${environment.auth.bearerToken}"`;
    } else if (environment.auth.type === 'apikey' && environment.auth.apiKey && environment.auth.apiKeyLocation === 'header') {
        command += ` \\\n  -H "${environment.auth.apiKeyName ?? 'X-API-Key'}: ${environment.auth.apiKey}"`;
    } else if (environment.auth.type === 'basic' && environment.auth.username && environment.auth.password) {
        command += ` \\\n  -u "${environment.auth.username}:${environment.auth.password}"`;
    }
    
    // Add content type for methods that typically have body
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        command += ` \\\n  -H "Content-Type: application/json"`;
        command += ` \\\n  -d '{}'`;
    }
    
    command += ' \\\n  -v';  // Verbose output
    
    return command;
}

/**
 * Generate Ansible task for an endpoint
 */
function generateAnsibleTask(endpoint: ApiEndpoint, environment: ApiEnvironment): string {
    const taskName = `${endpoint.method} ${endpoint.path}`;
    const url = `${environment.baseUrl}${endpoint.path}`;
    
    let task = `---
- name: "${taskName}"
  uri:
    url: "${url}"
    method: ${endpoint.method}`;
    
    // Add authentication
    if (environment.auth.type === 'bearer' && environment.auth.bearerToken) {
        task += `\n    headers:\n      Authorization: "Bearer ${environment.auth.bearerToken}"`;
    } else if (environment.auth.type === 'apikey' && environment.auth.apiKey && environment.auth.apiKeyLocation === 'header') {
        task += `\n    headers:\n      ${environment.auth.apiKeyName ?? 'X-API-Key'}: "${environment.auth.apiKey}"`;
    } else if (environment.auth.type === 'basic' && environment.auth.username && environment.auth.password) {
        task += `\n    user: "${environment.auth.username}"\n    password: "${environment.auth.password}"`;
    }
    
    // Add body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        task += `\n    body_format: json\n    body: {}`;
    }
    
    task += `\n    return_content: yes\n    status_code: [200, 201, 204]`;
    
    return task;
}

/**
 * Generate PowerShell script for an endpoint
 */
function generatePowerShellScript(endpoint: ApiEndpoint, environment: ApiEnvironment): string {
    const url = `${environment.baseUrl}${endpoint.path}`;
    
    let script = `# PowerShell script for ${endpoint.method} ${endpoint.path}\n\n`;
    script += `$uri = "${url}"\n`;
    script += `$method = "${endpoint.method}"\n\n`;
    
    // Prepare headers
    script += `$headers = @{\n`;
    script += `    "Content-Type" = "application/json"\n`;
    
    if (environment.auth.type === 'bearer' && environment.auth.bearerToken) {
        script += `    "Authorization" = "Bearer ${environment.auth.bearerToken}"\n`;
    } else if (environment.auth.type === 'apikey' && environment.auth.apiKey && environment.auth.apiKeyLocation === 'header') {
        script += `    "${environment.auth.apiKeyName ?? 'X-API-Key'}" = "${environment.auth.apiKey}"\n`;
    }
    
    script += `}\n\n`;
    
    // Add body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        script += `$body = @{} | ConvertTo-Json\n\n`;
        script += `try {\n    $response = Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Body $body\n`;
    } else {
        script += `try {\n    $response = Invoke-RestMethod -Uri $uri -Method $method -Headers $headers\n`;
    }
    
    script += `    Write-Output $response\n} catch {\n    Write-Error $_.Exception.Message\n}`;
    
    return script;
}

/**
 * Generate Python code for an endpoint
 */
function generatePythonCode(endpoint: ApiEndpoint, environment: ApiEnvironment): string {
    const url = `${environment.baseUrl}${endpoint.path}`;
    
    let code = `# Python code for ${endpoint.method} ${endpoint.path}\n\n`;
    code += `import requests\nimport json\n\n`;
    code += `url = "${url}"\n`;
    
    // Prepare headers
    code += `headers = {\n    "Content-Type": "application/json"`;
    
    if (environment.auth.type === 'bearer' && environment.auth.bearerToken) {
        code += `,\n    "Authorization": "Bearer ${environment.auth.bearerToken}"`;
    } else if (environment.auth.type === 'apikey' && environment.auth.apiKey && environment.auth.apiKeyLocation === 'header') {
        code += `,\n    "${environment.auth.apiKeyName ?? 'X-API-Key'}": "${environment.auth.apiKey}"`;
    }
    
    code += `\n}\n\n`;
    
    // Generate request
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        code += `data = {}\n\n`;
        code += `try:\n    response = requests.${endpoint.method.toLowerCase()}(url, headers=headers, json=data)\n`;
    } else {
        code += `try:\n    response = requests.${endpoint.method.toLowerCase()}(url, headers=headers)\n`;
    }
    
    code += `    response.raise_for_status()\n    print(response.json())\nexcept requests.exceptions.RequestException as e:\n    print(f"Error: {e}")`;
    
    return code;
}

/**
 * Generate JavaScript code for an endpoint
 */
function generateJavaScriptCode(endpoint: ApiEndpoint, environment: ApiEnvironment): string {
    const url = `${environment.baseUrl}${endpoint.path}`;
    
    let code = `// JavaScript code for ${endpoint.method} ${endpoint.path}\n\n`;
    
    // Prepare headers
    code += `const headers = {\n    "Content-Type": "application/json"`;
    
    if (environment.auth.type === 'bearer' && environment.auth.bearerToken) {
        code += `,\n    "Authorization": "Bearer ${environment.auth.bearerToken}"`;
    } else if (environment.auth.type === 'apikey' && environment.auth.apiKey && environment.auth.apiKeyLocation === 'header') {
        code += `,\n    "${environment.auth.apiKeyName ?? 'X-API-Key'}": "${environment.auth.apiKey}"`;
    }
    
    code += `\n};\n\n`;
    
    // Generate fetch request
    code += `const url = "${url}";\n\n`;
    
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        code += `const data = {};\n\n`;
        code += `fetch(url, {\n    method: "${endpoint.method}",\n    headers: headers,\n    body: JSON.stringify(data)\n})`;
    } else {
        code += `fetch(url, {\n    method: "${endpoint.method}",\n    headers: headers\n})`;
    }
    
    code += `\n.then(response => {\n    if (!response.ok) {\n        throw new Error(\`HTTP error! status: \${response.status}\`);\n    }\n    return response.json();\n})\n.then(data => console.log(data))\n.catch(error => console.error('Error:', error));`;
    
    return code;
}
