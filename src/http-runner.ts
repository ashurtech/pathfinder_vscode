import * as vscode from 'vscode';
import { ApiEnvironment, EndpointInfo } from './types';
import { ConfigurationManager } from './configuration';

export interface HttpRequest {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
    queryParams?: Record<string, string>;
    environmentId?: string;
}

export interface HttpResponse {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    responseTime: number;
    size: number;
}

export class HttpRequestRunner {
    private readonly outputChannel: vscode.OutputChannel;
    private readonly credentialStore: Map<string, Record<string, string>> = new Map();
    private readonly configManager: ConfigurationManager;

    constructor(configManager: ConfigurationManager) {
        this.configManager = configManager;
        this.outputChannel = vscode.window.createOutputChannel('Pathfinder HTTP Runner');
    }

    /**
     * Store credentials securely for a document
     */
    private storeCredentials(documentUri: string, credentials: Record<string, string>): void {
        this.credentialStore.set(documentUri, credentials);
    }

    /**
     * Retrieve stored credentials for a document
     */
    private getStoredCredentials(documentUri: string): Record<string, string> | undefined {
        return this.credentialStore.get(documentUri);
    }

    /**
     * Clear stored credentials for a document
     */
    private clearStoredCredentials(documentUri: string): void {
        this.credentialStore.delete(documentUri);
    }

    /**
     * Mask sensitive values for security display
     */
    private maskSensitiveValue(value: string): string {
        if (!value || value.length <= 4) {
            return '****';
        }
        
        // Show first 4 characters, then mask the rest
        const visible = value.substring(0, 4);
        const masked = '*'.repeat(Math.min(value.length - 4, 20)); // Limit mask length for readability
        return `${visible}${masked}`;
    }

    /**
     * Extract credentials from content before masking
     */
    private extractCredentialsFromContent(content: string): Record<string, string> {
        const credentials: Record<string, string> = {};
        
        // Extract Bearer tokens
        const bearerMatch = /Authorization: Bearer ([a-zA-Z0-9+/=._-]+)(?! # 👁️)/g.exec(content);
        if (bearerMatch) {
            credentials['Authorization'] = `Bearer ${bearerMatch[1]}`;
        }
        
        // Extract API keys
        const apiKeyMatch = /X-API-Key: ([a-zA-Z0-9+/=._-]+)(?! # 👁️)/g.exec(content);
        if (apiKeyMatch) {
            credentials['X-API-Key'] = apiKeyMatch[1];
        }
        
        // Extract Basic auth
        const basicMatch = /Authorization: Basic ([a-zA-Z0-9+/=]+)(?! # 👁️)/g.exec(content);
        if (basicMatch) {
            credentials['Authorization'] = `Basic ${basicMatch[1]}`;
        }
        
        return credentials;
    }

    /**
     * Unmask authorization headers by replacing masked content with original
     */
    private unmaskAuthHeaders(content: string): string {
        let result = content;
        
        // Replace masked Bearer tokens
        const bearerRegex = /# PATHFINDER_HIDDEN_AUTH: (Bearer .+)/;
        const bearerMatch = bearerRegex.exec(content);
        if (bearerMatch) {
            const originalAuth = bearerMatch[1];
            result = result.replace(/Authorization: Bearer .+ # 👁️ Click to toggle visibility/, 
                `Authorization: ${originalAuth}`);
        }
        
        // Replace masked API keys
        const apiKeyRegex = /# PATHFINDER_HIDDEN_API_KEY: (.+)/;
        const apiKeyMatch = apiKeyRegex.exec(content);
        if (apiKeyMatch) {
            const originalKey = apiKeyMatch[1];
            result = result.replace(/X-API-Key: .+ # 👁️ Click to toggle visibility/, 
                `X-API-Key: ${originalKey}`);
        }
        
        // Replace masked Basic auth
        const basicRegex = /# PATHFINDER_HIDDEN_BASIC: (Basic .+)/;
        const basicMatch = basicRegex.exec(content);
        if (basicMatch) {
            const originalBasic = basicMatch[1];
            result = result.replace(/Authorization: Basic .+ # 👁️ Click to toggle visibility/, 
                `Authorization: ${originalBasic}`);
        }
        
        // Remove the hidden comment lines
        result = result.replace(/# PATHFINDER_HIDDEN_[A-Z_]+: .+\n/g, '');
        
        return result;
    }

    /**
     * Unmask authorization headers using securely stored credentials
     */
    private unmaskAuthHeadersSecure(content: string, storedCredentials: Record<string, string>): string {
        let result = content;
        
        // Replace masked authorization headers with stored values
        if (storedCredentials['Authorization']) {
            result = result.replace(
                /Authorization: [^#]+# 👁️ Click to toggle visibility/g,
                storedCredentials['Authorization']
            );
        }
        
        if (storedCredentials['X-API-Key']) {
            result = result.replace(
                /X-API-Key: [^#]+# 👁️ Click to toggle visibility/g,
                `X-API-Key: ${storedCredentials['X-API-Key']}`
            );
        }
        
        return result;
    }

    /**
     * Mask authorization headers by replacing original content with masked version
     */
    private maskAuthHeaders(content: string): string {
        let result = content;
          // Mask Bearer tokens
        result = result.replace(/Authorization: Bearer ([a-zA-Z0-9+/=._-]+)(?! # 👁️)/g, (match, token) => {
            const masked = this.maskSensitiveValue(token);
            return `Authorization: Bearer ${masked} # 👁️ Click to toggle visibility`;
        });
        
        // Mask API keys
        result = result.replace(/X-API-Key: ([a-zA-Z0-9+/=._-]+)(?! # 👁️)/g, (match, key) => {
            const masked = this.maskSensitiveValue(key);
            return `X-API-Key: ${masked} # 👁️ Click to toggle visibility`;
        });
        
        // Mask Basic auth
        result = result.replace(/Authorization: Basic ([a-zA-Z0-9+/=]+)(?! # 👁️)/g, (match, credentials) => {
            const masked = this.maskSensitiveValue(credentials);
            return `Authorization: Basic ${masked} # 👁️ Click to toggle visibility`;
        });
        
        return result;
    }    /**
     * Generate HTTP request skeleton from OpenAPI endpoint
     */
    generateRequestSkeleton(endpoint: EndpointInfo, environment: ApiEnvironment, platformConfig?: any): string {
        const baseUrl = environment.baseUrl.replace(/\/$/, '');
        const path = endpoint.path;
        const method = endpoint.method.toUpperCase();
        
        // Build URL with path parameters placeholder
        let url = `${baseUrl}${path}`;
        const pathParams = this.extractPathParameters(path);
        
        // Generate headers
        const headers: string[] = [
            'Content-Type: application/json',
            'Accept: application/json'
        ];
        
        // Add platform-specific required headers (like kbn-xsrf for Kibana)
        if (platformConfig?.requiredHeaders) {
            for (const [headerName, headerValue] of Object.entries(platformConfig.requiredHeaders)) {
                headers.push(`${headerName}: ${headerValue}`);
            }
        }
        
        // Add authentication headers based on environment (with security masking)
        if (environment.auth.type === 'bearer' && environment.auth.bearerToken) {
            const maskedToken = this.maskSensitiveValue(environment.auth.bearerToken);
            headers.push(`Authorization: Bearer ${maskedToken} # 👁️ Click to toggle visibility`);
        } else if (environment.auth.type === 'apikey' && environment.auth.apiKey) {
            const maskedKey = this.maskSensitiveValue(environment.auth.apiKey);
            headers.push(`X-API-Key: ${maskedKey} # 👁️ Click to toggle visibility`);
        } else if (environment.auth.type === 'basic' && environment.auth.username && environment.auth.password) {
            const credentials = Buffer.from(`${environment.auth.username}:${environment.auth.password}`).toString('base64');
            const maskedCredentials = this.maskSensitiveValue(credentials);
            headers.push(`Authorization: Basic ${maskedCredentials} # 👁️ Click to toggle visibility`);
        }

        // Generate request body for POST/PUT/PATCH
        let bodySection = '';
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
            bodySection = `
{
  // Add your request body here
  // Example: "name": "value"
}`;
        }

        // Generate query parameters section
        let querySection = '';
        if (endpoint.parameters && endpoint.parameters.length > 0) {
            const queryParams = endpoint.parameters
                .filter(p => p.in === 'query')
                .map(p => `${p.name}=${p.required ? '<REQUIRED>' : '<optional>'}`)
                .join('&');
            
            if (queryParams) {
                querySection = `?${queryParams}`;
            }
        }
        
        // Build the complete request
        const requestTitle = endpoint.summary ?? `${method} ${path}`;
        const requestDescription = endpoint.description ?? 'No description available';
        
        const request = `### ${requestTitle}
# Environment: ${environment.name}
# Description: ${requestDescription}

${method} ${url}${querySection}
${headers.join('\n')}
${bodySection ? '\n' + bodySection : ''}

### Path Parameters
${pathParams.map(p => `# ${p}: <value>`).join('\n') || '# No path parameters'}

### Notes
# - Fill in the placeholders marked with < >
# - Remove optional parameters if not needed
# - Click the "▶ Run Request" button to execute
`;

        return request;
    }

    /**
     * Parse HTTP request from editor content
     */    parseHttpRequest(content: string): HttpRequest | null {
        try {
            const lines = content.split('\n').filter(line => !line.trim().startsWith('#') && line.trim());
            
            if (lines.length === 0) {
                return null;
            }

            // Find the first line that looks like an HTTP request (METHOD URL)
            let requestLineIndex = -1;
            let requestLine = '';
            const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'TRACE'];
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                const parts = line.split(' ');
                
                if (parts.length >= 2 && httpMethods.includes(parts[0].toUpperCase()) && parts[1].startsWith('http')) {
                    requestLineIndex = i;
                    requestLine = line;
                    break;
                }
            }
            
            if (requestLineIndex === -1 || !requestLine) {
                this.outputChannel.appendLine('No valid HTTP request line found');
                return null;
            }

            // Parse request line (method + URL)
            const [method, fullUrl] = requestLine.split(' ', 2);

            if (!method || !fullUrl) {
                this.outputChannel.appendLine(`Invalid request line format: ${requestLine}`);
                return null;
            }

            // Split URL and query params
            const [url, queryString] = fullUrl.split('?', 2);
            const queryParams: Record<string, string> = {};
            
            if (queryString) {
                queryString.split('&').forEach(param => {
                    const [key, value] = param.split('=', 2);
                    if (key && value) {
                        queryParams[decodeURIComponent(key)] = decodeURIComponent(value);
                    }
                });
            }            // Parse headers - start from the line after the request line
            const headers: Record<string, string> = {};
            let bodyStartIndex = -1;

            for (let i = requestLineIndex + 1; i < lines.length; i++) {
                const line = lines[i].trim();
                
                if (line === '' || line.startsWith('{') || line.startsWith('[')) {
                    bodyStartIndex = i;
                    break;
                }                const colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                    const key = line.substring(0, colonIndex).trim();
                    let value = line.substring(colonIndex + 1).trim();
                    
                    // Remove comments from header values (e.g., "Bearer token # 👁️ Click to toggle visibility")
                    const commentIndex = value.indexOf('#');
                    if (commentIndex > 0) {
                        value = value.substring(0, commentIndex).trim();
                    }
                    
                    headers[key] = value;
                }
            }

            // Parse body
            let body: string | undefined;
            if (bodyStartIndex >= 0) {
                const bodyLines = lines.slice(bodyStartIndex);
                body = bodyLines.join('\n').trim();
                
                // Try to parse and reformat JSON
                if (body.startsWith('{') || body.startsWith('[')) {
                    try {
                        const parsed = JSON.parse(body);
                        body = JSON.stringify(parsed);
                    } catch {
                        // Keep original body if JSON parsing fails
                    }
                }
            }

            return {
                method: method.toUpperCase(),
                url,
                headers,
                body,
                queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined
            };

        } catch (error) {
            this.outputChannel.appendLine(`Error parsing HTTP request: ${error}`);
            return null;
        }
    }

    /**
     * Parse an HTTP request file and extract credentials if needed
     */
    parseHttpRequestWithCredentials(content: string, documentUri: string): HttpRequest | undefined {
        // Basic parsing of the request
        const request = this.parseHttpRequest(content);
        if (!request) {
            return undefined;
        }

        // Add environment ID if available
        const match = content.match(/^# Environment: (.+)$/m);
        if (match) {
            request.environmentId = match[1];
        }

        return request;
    }

    /**
     * Execute an HTTP request with resolved environment configuration
     */
    async executeRequest(request: HttpRequest): Promise<any> {
        if (!request.environmentId) {
            throw new Error('Environment ID is required to execute request');
        }

        // Get environment configuration
        const config = await this.configManager.resolveEnvironmentConfig(request.environmentId);
        if (!config) {
            throw new Error('Environment not found');
        }

        // Merge headers
        const headers = {
            ...config.resolvedHeaders,
            ...request.headers
        };

        // Make the request
        // Implementation details...
    }

    /**
     * Format response for display
     */
    formatResponse(response: HttpResponse, originalRequest: HttpRequest): string {
        const statusColor = response.status >= 200 && response.status < 300 ? '✅' : '❌';
        
        let formattedBody = response.body;
        try {
            // Try to format JSON response
            const parsed = JSON.parse(response.body);
            formattedBody = JSON.stringify(parsed, null, 2);
        } catch {
            // Keep original if not JSON
        }

        return `### HTTP Response ${statusColor}

**Request:**
\`${originalRequest.method} ${originalRequest.url}\`

**Status:** ${response.status} ${response.statusText}
**Response Time:** ${response.responseTime}ms
**Size:** ${this.formatBytes(response.size)}

**Response Headers:**
\`\`\`
${Object.entries(response.headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')}
\`\`\`

**Response Body:**
\`\`\`json
${formattedBody}
\`\`\`
`;
    }    /**
     * Open HTTP request editor
     */
    async openRequestEditor(endpoint: EndpointInfo, environment: ApiEnvironment, platformConfig?: any): Promise<void> {
        try {
            const skeleton = this.generateRequestSkeleton(endpoint, environment, platformConfig);
            
            // Create new untitled document
            const document = await vscode.workspace.openTextDocument({
                content: skeleton,
                language: 'http'
            });

            // Store credentials securely for this document
            const credentials: Record<string, string> = {};
            if (environment.auth.type === 'bearer' && environment.auth.bearerToken) {
                credentials['Authorization'] = `Bearer ${environment.auth.bearerToken}`;
            } else if (environment.auth.type === 'apikey' && environment.auth.apiKey) {
                credentials['X-API-Key'] = environment.auth.apiKey;
            } else if (environment.auth.type === 'basic' && environment.auth.username && environment.auth.password) {
                const basicCredentials = Buffer.from(`${environment.auth.username}:${environment.auth.password}`).toString('base64');
                credentials['Authorization'] = `Basic ${basicCredentials}`;
            }
            
            if (Object.keys(credentials).length > 0) {
                this.storeCredentials(document.uri.toString(), credentials);
            }

            // Show in editor
            await vscode.window.showTextDocument(document, {
                preview: false,
                viewColumn: vscode.ViewColumn.One
            });

            vscode.window.showInformationMessage(
                'HTTP request skeleton created! Fill in the details and click "▶ Run Request" to execute.'
            );

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to open request editor: ${errorMessage}`);
            this.outputChannel.appendLine(`Error opening request editor: ${errorMessage}`);
        }
    }    /**
     * Display response in new tab
     */
    async displayResponse(response: HttpResponse, originalRequest: HttpRequest): Promise<void> {
        try {
            const formattedResponse = this.formatResponse(response, originalRequest);
            
            // Create new untitled document for response
            const document = await vscode.workspace.openTextDocument({
                content: formattedResponse,
                language: 'plaintext'
            });

            // Show in new column
            await vscode.window.showTextDocument(document, {
                preview: false,
                viewColumn: vscode.ViewColumn.Two
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to display response: ${errorMessage}`);
            this.outputChannel.appendLine(`Error displaying response: ${errorMessage}`);
        }
    }

    private extractPathParameters(path: string): string[] {
        const matches = path.match(/\{([^}]+)\}/g);
        return matches ? matches.map(match => match.slice(1, -1)) : [];
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) {
            return '0 B';
        }
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * Toggle visibility of authorization headers in HTTP file
     */
    async toggleAuthVisibility(document: vscode.TextDocument): Promise<void> {
        try {
            const content = document.getText();
            const isCurrentlyMasked = content.includes('👁️ Click to toggle visibility');
            const storedCredentials = this.getStoredCredentials(document.uri.toString());
            
            let newContent: string;
            if (isCurrentlyMasked && storedCredentials) {
                // Unmask using stored credentials
                newContent = this.unmaskAuthHeadersSecure(content, storedCredentials);
                vscode.window.showInformationMessage('🔓 Authorization headers revealed');
            } else {
                // Mask the auth headers (also store credentials if not already stored)
                if (!storedCredentials) {
                    const extractedCredentials = this.extractCredentialsFromContent(content);
                    if (Object.keys(extractedCredentials).length > 0) {
                        this.storeCredentials(document.uri.toString(), extractedCredentials);
                    }
                }
                newContent = this.maskAuthHeaders(content);
                vscode.window.showInformationMessage('🔒 Authorization headers masked for security');
            }
            
            // Apply the changes to the document
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(content.length)
            );
            edit.replace(document.uri, fullRange, newContent);
            
            await vscode.workspace.applyEdit(edit);
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to toggle auth visibility: ${errorMessage}`);
            this.outputChannel.appendLine(`Error toggling auth visibility: ${errorMessage}`);
        }
    }

    /**
     * Check if document contains masked authorization headers
     */
    hasMaskedAuth(content: string): boolean {
        return content.includes('👁️ Click to toggle visibility');
    }

    /**
     * Check if document contains unmasked authorization headers
     */
    hasUnmaskedAuth(content: string): boolean {
        const authPatterns = [
            /Authorization: Bearer [a-zA-Z0-9+/=]{20,}(?! # 👁️)/,
            /Authorization: Basic [a-zA-Z0-9+/=]{20,}(?! # 👁️)/,
            /X-API-Key: [a-zA-Z0-9+/=_-]{20,}(?! # 👁️)/
        ];
        
        return authPatterns.some(pattern => pattern.test(content));
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}
