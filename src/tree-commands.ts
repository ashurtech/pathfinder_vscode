/**
 * Tree View Commands
 * 
 * These are the commands that get executed when users interact with the tree view.
 * Each tree item can have a command that runs when clicked, and context menu items.
 */

import * as vscode from 'vscode';
import { ApiEnvironment, LoadedSchema, ApiEndpoint, RequestGeneratorConfig, PLATFORM_CONFIGS } from './types';
import { SchemaLoader } from './schema-loader';
import { ConfigurationManager } from './configuration';

let skipDeleteConfirmation = false;

/**
 * Utility: Confirm before running a DELETE command, with option to skip for session
 */
export async function confirmDeleteAction(message: string): Promise<boolean> {
    if (skipDeleteConfirmation){return true;}
    const result = await vscode.window.showWarningMessage(
        message + '\nThis action cannot be undone.',
        { modal: true },
        'Delete',
        "Don't ask again this session",
        'Cancel'
    );
    if (result === "Don't ask again this session") {
        skipDeleteConfirmation = true;
        return true;
    }
    return result === 'Delete';
}

/**
 * Determine platform configuration for a schema/environment
 */
function getPlatformConfig(schema?: LoadedSchema, environment?: ApiEnvironment): RequestGeneratorConfig {
    // First priority: explicit platform config from schema
    if (schema?.platformConfig) {
        return schema.platformConfig;
    }
    
    // Second priority: auto-detect from environment name/URL
    if (environment) {
        const envName = environment.name.toLowerCase();
        const envUrl = environment.baseUrl.toLowerCase();
        
        if (envName.includes('kibana') || envUrl.includes('kibana')) {
            return PLATFORM_CONFIGS.kibana;
        }
        
        if (envName.includes('elasticsearch') || envUrl.includes('elasticsearch')) {
            return PLATFORM_CONFIGS.elasticsearch;
        }
    }
    
    // Default: generic configuration
    return PLATFORM_CONFIGS.generic;
}

/**
 * Apply platform-specific headers to a headers object
 */
function applyPlatformHeaders(headers: Record<string, string>, platformConfig: RequestGeneratorConfig): Record<string, string> {
    const result = { ...headers };
    
    // Add required headers from platform config
    if (platformConfig.requiredHeaders) {
        Object.assign(result, platformConfig.requiredHeaders);
    }
    
    return result;
}

/**
 * Get platform-specific authentication header format
 */
function getPlatformAuthHeader(auth: any, platformConfig: RequestGeneratorConfig): string | null {
    if (auth.type === 'bearer' && auth.bearerToken) {
        return `Bearer ${auth.bearerToken}`;
    }
    
    if (auth.type === 'apikey' && auth.apiKey && auth.apiKeyLocation === 'header') {
        const headerFormat = platformConfig.authConfig?.headerFormat;
        if (headerFormat === 'ApiKey') {
            return `ApiKey ${auth.apiKey}`;
        }
        return auth.apiKey;
    }
    
    if (auth.type === 'basic' && auth.username && auth.password) {
        const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
        return `Basic ${credentials}`;
    }
    
    return null;
}

/**
 * Show detailed information about an environment when clicked in tree
 */
export async function showEnvironmentDetailsCommand(environment: ApiEnvironment) {
    // Use ASCII dividers and all-caps section headers, no markdown headers
    const details = [
        `╔════════════════════════════════════════════════════════════╗`,
        ` ENVIRONMENT DETAILS`,
        `╚════════════════════════════════════════════════════════════╝`,
        '',
        `Name:         ${environment.name}`,
        `Base URL:     ${environment.baseUrl}`,
        `Auth Type:    ${environment.auth.type}`,
        `Created:      ${environment.createdAt.toLocaleString()}`,
        environment.lastUsed ? `Last Used:    ${environment.lastUsed.toLocaleString()}` : 'Last Used:   Never used',
        environment.description ? `Description:  ${environment.description}` : '',
        '',
    ].filter(line => line !== '').join('\n');
    const doc = await vscode.workspace.openTextDocument({
        content: details,
        language: 'plaintext'
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
        `╔════════════════════════════════════════════════════════════╗`,
        ` SCHEMA DETAILS`,
        `╚════════════════════════════════════════════════════════════╝`,
        '',
        `Title:        ${info.title}`,
        `Version:      ${info.version}`,
        info.description ? `Description:   ${info.description}` : '',
        `Servers:      ${info.serverCount}`,
        `Paths:        ${info.pathCount}`,
        `Endpoints:    ${info.endpointCount}`,
        '',
        `Source:       ${schema.source}`,
        `Loaded:       ${schema.loadedAt.toLocaleString()}`,
        `Valid:        ${schema.isValid ? 'YES' : 'NO'}`,
        '',
        schema.validationErrors && schema.validationErrors.length > 0 ? 
            [
                'Validation Errors:',
                ...schema.validationErrors.map(err => `  - ${err}`)
            ].join('\n') : ''
    ].filter(line => line !== '').join('\n');
    const doc = await vscode.workspace.openTextDocument({
        content: details,
        language: 'plaintext'
    });
    await vscode.window.showTextDocument(doc);
}

/**
 * Show detailed information about an API endpoint when clicked in tree
 */
export async function showEndpointDetailsCommand(endpoint: ApiEndpoint, schemaItem: any) {
    // Compose the HTTP request line
    const baseUrl = schemaItem?.environment?.baseUrl ?? '';
    const fullUrl = baseUrl ? `${baseUrl}${endpoint.path}` : endpoint.path;

    // Compose headers for http syntax highlighting
    let headers: string[] = [];
    if (endpoint.parameters && endpoint.parameters.length > 0) {
        const headerParams = endpoint.parameters.filter(p => p.in === 'header');
        headers = headerParams.map(param => `${param.name}: <${param.name}>`);
    }

    // Compose body (if any)
    let body = '';
    if (endpoint.requestBody) {
        try {
            body = JSON.stringify(endpoint.requestBody, null, 2);
        } catch {
            body = String(endpoint.requestBody);
        }
    }

    // Build the http-formatted request preview with enhanced formatting
    let httpPreview = '';
    httpPreview += `╔════════════════════════════════════════════════════════════╗\n`;
    httpPreview += ` API REQUEST PREVIEW\n`;
    httpPreview += `╚════════════════════════════════════════════════════════════╝\n`;
    httpPreview += `\n`;
    if (endpoint.summary) {
        httpPreview += `• ${endpoint.summary.toUpperCase()}\n`;
    }
    httpPreview += `------------------------------------------------------------\n`;
    httpPreview += `REQUEST LINE\n`;
    httpPreview += `${endpoint.method} ${fullUrl}\n`;
    if (headers.length) {
        httpPreview += `\nHEADERS\n`;
        httpPreview += headers.map(h => h).join('\n') + '\n';
    }
    if (body) {
        httpPreview += `\nBODY\n`;
        httpPreview += body + '\n';
    }
    httpPreview += `\n============================================================\n`;

    // Add details section with clear, visually distinct headings
    let details = '';
    details += `\n╔════════════════════════════════════════════════════════════╗\n`;
    details += ` ENDPOINT DETAILS\n`;
    details += `╚════════════════════════════════════════════════════════════╝\n`;
    details += `\nDESCRIPTION\n`;
    details += `  ${endpoint.description ?? 'No description'}\n`;
    if (endpoint.operationId) {
        details += `\nOPERATION ID\n`;
        details += `  ${endpoint.operationId}\n`;
    }
    if (endpoint.tags && endpoint.tags.length > 0) {
        details += `\nTAGS\n`;
        details += `  ${endpoint.tags.join(', ')}\n`;
    }
    details += `\nPARAMETERS`;
    if (endpoint.parameters && endpoint.parameters.length > 0) {
        details += '\n';
        details += endpoint.parameters.map(param =>
            `  - ${param.name} (${param.in}) ${param.required ? '[REQUIRED]' : '[OPTIONAL]'}: ${param.description ?? 'No description'}`
        ).join('\n');
    } else {
        details += '  None';
    }
    details += '\n\nRESPONSES:';
    if (endpoint.responses) {
        details += '\n';
        details += Object.entries(endpoint.responses).map(([code, response]) =>
            `  - ${code}: ${typeof response === 'object' ? JSON.stringify(response, null, 2) : response}`
        ).join('\n');
    } else {
        details += '  None';
    }
    details += '\n============================================================\n';

    // Combine for display
    const content = `${httpPreview}\n${details}`;

    // Show in a new untitled document with http highlighting
    const doc = await vscode.workspace.openTextDocument({
        content,
        language: 'http'
    });
    await vscode.window.showTextDocument(doc);
}

/**
 * Generate code for an endpoint with support for different formats
 */
export async function generateCodeForEndpointCommand(endpoint: ApiEndpoint, schemaItem: any, format: string = 'curl') {
    try {
        // Get environment from schemaItem
        const environment = schemaItem.environment;
        if (!environment) {
            vscode.window.showErrorMessage('No environment found for this endpoint. Please add an environment first.');
            return;
        }

        // Ensure environment has a baseUrl
        if (!environment.baseUrl) {
            vscode.window.showErrorMessage('Environment is missing a base URL. Please edit the environment to add a base URL.');
            return;
        }

        const schema = schemaItem.schema;
        const platformConfig = getPlatformConfig(schema, environment);
        
        let generatedCode: string;
        let language: string;
        let title: string;
        
        switch (format.toLowerCase()) {
            case 'curl':
                generatedCode = generateCurlCommand(endpoint, environment, platformConfig);
                language = 'shellscript';
                title = 'cURL Command';
                break;
            case 'ansible':
                generatedCode = generateAnsibleTask(endpoint, environment, platformConfig);
                language = 'yaml';
                title = 'Ansible Task';
                break;
            case 'powershell':
                generatedCode = generatePowerShellScript(endpoint, environment, platformConfig);
                language = 'powershell';
                title = 'PowerShell Script';
                break;
            case 'python':
                generatedCode = generatePythonCode(endpoint, environment, platformConfig);
                language = 'python';
                title = 'Python Code';
                break;
            case 'javascript':
                generatedCode = generateJavaScriptCode(endpoint, environment, platformConfig);
                language = 'javascript';
                title = 'JavaScript Code';
                break;
            default:
                generatedCode = generateCurlCommand(endpoint, environment, platformConfig);
                language = 'shellscript';
                title = 'cURL Command';
                break;
        }
        
        const doc = await vscode.workspace.openTextDocument({
            content: `# ${title} for ${endpoint.method} ${endpoint.path}\n\n${generatedCode}`,
            language: language
        });
        
        await vscode.window.showTextDocument(doc);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to generate code: ${errorMessage}`);
    }
}

/**
 * Test an endpoint by making a real request
 */
export async function testEndpointCommand(endpoint: ApiEndpoint, schemaItem: any) {
    // Show a simple dialog for now - we can expand this later
    const result = await vscode.window.showInformationMessage(
        `Test ${endpoint.method} ${endpoint.path}?`,
        { modal: true },
        'Test Now', 'Cancel'
    );
    if (result === 'Test Now') {
        vscode.window.showInformationMessage('Endpoint testing coming soon! 🚀');
    }
}

/**
 * Generate cURL command for an endpoint
 */
function generateCurlCommand(endpoint: ApiEndpoint, environment: ApiEnvironment, platformConfig?: RequestGeneratorConfig): string {
    const url = `${environment.baseUrl}${endpoint.path}`;
    let command = `curl -X ${endpoint.method} "${url}"`;
    
    const config = platformConfig ?? getPlatformConfig(undefined, environment);
    
    // Add authentication headers
    const authHeader = getPlatformAuthHeader(environment.auth, config);
    if (authHeader) {
        if (environment.auth.type === 'basic') {
            command += ` \\\n  -u "${environment.auth.username}:${environment.auth.password}"`;
        } else {
            command += ` \\\n  -H "Authorization: ${authHeader}"`;
        }
    }
    
    // Apply platform-specific headers
    const headers = applyPlatformHeaders({}, config);
    for (const [key, value] of Object.entries(headers)) {
        command += ` \\\n  -H "${key}: ${value}"`;
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
function generateAnsibleTask(endpoint: ApiEndpoint, environment: ApiEnvironment, platformConfig?: RequestGeneratorConfig): string {
    const taskName = `${endpoint.method} ${endpoint.path}`;
    const url = `${environment.baseUrl}${endpoint.path}`;
    
    const config = platformConfig ?? getPlatformConfig(undefined, environment);
    
    let task = `---
- name: "${taskName}"
  uri:
    url: "${url}"
    method: ${endpoint.method}`;
    
    // Prepare headers
    const headers: string[] = [];
    
    // Apply platform-specific headers
    const platformHeaders = applyPlatformHeaders({}, config);
    for (const [key, value] of Object.entries(platformHeaders)) {
        headers.push(`      ${key}: "${value}"`);
    }
    
    // Add authentication
    const authHeader = getPlatformAuthHeader(environment.auth, config);
    if (authHeader) {
        if (environment.auth.type === 'basic') {
            task += `\n    user: "${environment.auth.username}"\n    password: "${environment.auth.password}"`;
        } else {
            headers.push(`      Authorization: "${authHeader}"`);
        }
    }
    
    // Add headers if any
    if (headers.length > 0) {
        task += `\n    headers:\n${headers.join('\n')}`;
    }
    
    // Add body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        task += `\n    body_format: json\n    body: {}`;
    }
    
    task += `\n    return_content: yes\n    status_code: [200, 201, 204]`;
    
    return task;
}

/**
 * Generate PowerShell script for an endpoint (Platform-optimized)
 */
function generatePowerShellScript(endpoint: ApiEndpoint, environment: ApiEnvironment, platformConfig?: RequestGeneratorConfig): string {
    const url = `${environment.baseUrl}${endpoint.path}`;
    const config = platformConfig ?? getPlatformConfig(undefined, environment);
    
    let script = `# PowerShell script for ${endpoint.method} ${endpoint.path}\n`;
    script += `# Generated by API Helper Extension\n`;
    
    // Add platform-specific comments
    if (config.codeGenHints?.comments) {
        config.codeGenHints.comments.forEach(comment => {
            script += `# ${comment}\n`;
        });
    }
    script += `\n`;
    
    script += `$uri = "${url}"\n$method = "${endpoint.method}"\n\n`;
    script += generatePowerShellHeaders(environment, config);
    script += generatePowerShellSSLSection(config);
    script += generatePowerShellRequestSection(endpoint);
    script += generatePowerShellErrorSection();
    
    return script;
}

/**
 * Generate PowerShell headers section
 */
function generatePowerShellHeaders(environment: ApiEnvironment, platformConfig: RequestGeneratorConfig): string {
    let script = `# Configure headers\n$headers = @{\n    "Content-Type" = "application/json"\n`;
    
    // Apply platform-specific headers
    const headers = applyPlatformHeaders({}, platformConfig);
    for (const [key, value] of Object.entries(headers)) {
        script += `    "${key}" = "${value}"\n`;
    }
    
    // Add authentication headers
    const authHeader = getPlatformAuthHeader(environment.auth, platformConfig);
    if (authHeader) {
        script += `    "Authorization" = "${authHeader}"\n`;
    }
    
    script += `}\n\n`;
    return script;
}

/**
 * Generate PowerShell SSL section
 */
function generatePowerShellSSLSection(platformConfig: RequestGeneratorConfig): string {
    if (!platformConfig.sslConfig?.allowSelfSigned) {
        return '';
    }
    
    const notes = platformConfig.sslConfig.notes ? ` (${platformConfig.sslConfig.notes})` : '';
    return `# Handle SSL certificates${notes}\n# Uncomment the next line if using self-signed certificates\n# [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}\n\n`;
}

/**
 * Generate PowerShell request section
 */
function generatePowerShellRequestSection(endpoint: ApiEndpoint): string {
    let script = `try {\n`;
    
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        script += generatePowerShellBodySection(endpoint);
        script += `    $response = Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Body $body -ErrorAction Stop\n`;
    } else {
        script += `    $response = Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -ErrorAction Stop\n`;
    }
    
    script += `\n    # Display the response\n    Write-Host "✅ Request successful!" -ForegroundColor Green\n    $response | ConvertTo-Json -Depth 10 | Write-Output\n`;
    return script;
}

/**
 * Generate PowerShell body section
 */
function generatePowerShellBodySection(endpoint: ApiEndpoint): string {
    let script = `    # Request body - customize based on your needs\n    $body = @{\n`;
    
    if (endpoint.parameters?.length) {
        const requiredParams = endpoint.parameters.filter(p => p.required);
        if (requiredParams.length > 0) {
            requiredParams.slice(0, 3).forEach(param => {
                script += `        "${param.name}" = ""  # ${param.description ?? 'No description'}\n`;
            });
        } else {
            script += `        # Add your request parameters here\n`;
        }
    } else {
        script += `        # Add your request parameters here\n`;
    }
    
    script += `    } | ConvertTo-Json -Depth 10\n\n`;
    return script;
}

/**
 * Generate PowerShell error handling section
 */
function generatePowerShellErrorSection(): string {
    return `} catch [System.Net.WebException] {
    $statusCode = [int]$_.Exception.Response.StatusCode
    $statusDesc = $_.Exception.Response.StatusDescription
    Write-Host "❌ HTTP Error: $statusCode - $statusDesc" -ForegroundColor Red
    
    # Try to get response body for more details
    try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        $reader.Close()
        Write-Host "Response Body: $responseBody" -ForegroundColor Yellow
    } catch {
        Write-Host "Could not read error response body" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Full Error Details:" -ForegroundColor Red
    $_.Exception | Format-List * | Out-String | Write-Host -ForegroundColor Red
}
`;
}

/**
 * Generate Python code for an endpoint
 */
function generatePythonCode(endpoint: ApiEndpoint, environment: ApiEnvironment, platformConfig?: RequestGeneratorConfig): string {
    const url = `${environment.baseUrl}${endpoint.path}`;
    const config = platformConfig ?? getPlatformConfig(undefined, environment);
    
    let code = `# Python code for ${endpoint.method} ${endpoint.path}\n\n`;
    code += `import requests\nimport json\n\n`;
    code += `url = "${url}"\n`;
    
    // Prepare headers
    code += `headers = {\n    "Content-Type": "application/json"`;
    
    // Apply platform-specific headers
    const headers = applyPlatformHeaders({}, config);
    for (const [key, value] of Object.entries(headers)) {
        code += `,\n    "${key}": "${value}"`;
    }
    
    // Add authentication
    const authHeader = getPlatformAuthHeader(environment.auth, config);
    if (authHeader) {
        code += `,\n    "Authorization": "${authHeader}"`;
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
function generateJavaScriptCode(endpoint: ApiEndpoint, environment: ApiEnvironment, platformConfig?: RequestGeneratorConfig): string {
    const url = `${environment.baseUrl}${endpoint.path}`;
    const config = platformConfig ?? getPlatformConfig(undefined, environment);
    
    let code = `// JavaScript code for ${endpoint.method} ${endpoint.path}\n\n`;
    
    // Prepare headers
    code += `const headers = {\n    "Content-Type": "application/json"`;
    
    // Apply platform-specific headers
    const headers = applyPlatformHeaders({}, config);
    for (const [key, value] of Object.entries(headers)) {
        code += `,\n    "${key}": "${value}"`;
    }
    
    // Add authentication
    const authHeader = getPlatformAuthHeader(environment.auth, config);
    if (authHeader) {
        code += `,\n    "Authorization": "${authHeader}"`;
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

/**
 * Show load schema options (from file or URL)
 */
export async function showLoadSchemaOptionsCommand(environment: ApiEnvironment) {
    const choice = await vscode.window.showQuickPick([
        {
            label: '📁 Load from File',
            description: 'Browse for an OpenAPI schema file on your computer',
            action: 'file'
        },
        {
            label: '🌐 Load from URL',
            description: 'Enter a URL to download the schema',
            action: 'url'
        }
    ], {
        placeHolder: 'How would you like to load the schema?'
    });

    if (choice) {
        if (choice.action === 'file') {
            await vscode.commands.executeCommand('pathfinder.loadSchemaFromFile', environment);
        } else {
            await vscode.commands.executeCommand('pathfinder.loadSchemaFromUrl', environment);
        }
    }
}

/**
 * Edit an existing environment
 */
export async function editEnvironmentCommand(environment: ApiEnvironment, configManager: ConfigurationManager) {
    // Show input for name
    const name = await vscode.window.showInputBox({
        prompt: 'Environment Name',
        value: environment.name,
        validateInput: (value) => {
            if (!value.trim()) {
                return 'Environment name cannot be empty';
            }
            return null;
        }
    });
    
    if (!name) {
        return; // User cancelled
    }
    
    // Show input for base URL
    const baseUrl = await vscode.window.showInputBox({
        prompt: 'Base URL',
        value: environment.baseUrl,
        validateInput: (value) => {
            if (!value.trim()) {
                return 'Base URL cannot be empty';
            }
            try {
                new URL(value);
                return null;
            } catch {
                return 'Please enter a valid URL';
            }
        }
    });
    
    if (!baseUrl) {
        return; // User cancelled
    }
    
    // Show description input
    const description = await vscode.window.showInputBox({
        prompt: 'Description (optional)',
        value: environment.description ?? ''
    });
    
    // Create updated environment
    const updatedEnvironment: ApiEnvironment = {
        ...environment,
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        description: description?.trim() ?? undefined
    };
    
    try {        await configManager.saveApiEnvironment(updatedEnvironment);
        vscode.window.showInformationMessage(`Environment "${name}" updated successfully!`);
        
        // Refresh tree view
        vscode.commands.executeCommand('pathfinder.refreshTree');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to update environment: ${error}`);
    }
}

/**
 * Duplicate an existing environment
 */
export async function duplicateEnvironmentCommand(environment: ApiEnvironment, configManager: ConfigurationManager) {
    // Generate a default name for the duplicate
    const defaultName = `${environment.name} (Copy)`;
    
    const name = await vscode.window.showInputBox({
        prompt: 'Name for duplicated environment',
        value: defaultName,
        validateInput: (value) => {
            if (!value.trim()) {
                return 'Environment name cannot be empty';
            }
            return null;
        }
    });
    
    if (!name) {
        return; // User cancelled
    }
    
    // Create new environment with same settings but new ID and name
    const newEnvironment: ApiEnvironment = {
        ...environment,
        id: `env_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name: name.trim(),
        createdAt: new Date(),
        lastUsed: undefined
    };
    
    try {        await configManager.saveApiEnvironment(newEnvironment);
        vscode.window.showInformationMessage(`Environment "${name}" created successfully!`);
        
        // Refresh tree view
        vscode.commands.executeCommand('pathfinder.refreshTree');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to duplicate environment: ${error}`);
    }
}
