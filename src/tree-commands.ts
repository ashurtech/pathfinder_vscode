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
 * Generate code for an endpoint (this will be expanded later)
 */
export async function generateCodeForEndpointCommand(endpoint: ApiEndpoint, environment: ApiEnvironment) {
    // This is a placeholder - we'll implement full code generation later
    const curlCommand = generateBasicCurlCommand(endpoint, environment);
    
    const doc = await vscode.workspace.openTextDocument({
        content: curlCommand,
        language: 'shellscript'
    });
    
    await vscode.window.showTextDocument(doc);
}

/**
 * Basic curl command generation (placeholder for full implementation)
 */
function generateBasicCurlCommand(endpoint: ApiEndpoint, environment: ApiEnvironment): string {
    const url = `${environment.baseUrl}${endpoint.path}`;
    let command = `curl -X ${endpoint.method} "${url}"`;
    
    // Add basic authentication
    if (environment.auth.type === 'bearer' && environment.auth.bearerToken) {
        command += ` \\\n  -H "Authorization: Bearer ${environment.auth.bearerToken}"`;
    } else if (environment.auth.type === 'apikey' && environment.auth.apiKey && environment.auth.apiKeyLocation === 'header') {
        command += ` \\\n  -H "${environment.auth.apiKeyName || 'X-API-Key'}: ${environment.auth.apiKey}"`;
    }
    
    // Add content type for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        command += ` \\\n  -H "Content-Type: application/json"`;
        command += ` \\\n  -d '{}'`;
    }
    
    return command;
}
