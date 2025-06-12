import * as vscode from 'vscode';
import { ApiEnvironment, EndpointInfo } from './types';

export interface HttpRequest {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
    queryParams?: Record<string, string>;
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

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Pathfinder HTTP Runner');
    }

    /**
     * Generate HTTP request skeleton from OpenAPI endpoint
     */
    generateRequestSkeleton(endpoint: EndpointInfo, environment: ApiEnvironment): string {
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
          // Add authentication headers based on environment
        if (environment.auth.type === 'bearer' && environment.auth.bearerToken) {
            headers.push(`Authorization: Bearer ${environment.auth.bearerToken}`);
        } else if (environment.auth.type === 'apikey' && environment.auth.apiKey) {
            headers.push(`X-API-Key: ${environment.auth.apiKey}`);
        } else if (environment.auth.type === 'basic' && environment.auth.username && environment.auth.password) {
            const credentials = Buffer.from(`${environment.auth.username}:${environment.auth.password}`).toString('base64');
            headers.push(`Authorization: Basic ${credentials}`);
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
        }        // Build the complete request
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
     */
    parseHttpRequest(content: string): HttpRequest | null {
        try {
            const lines = content.split('\n').filter(line => !line.trim().startsWith('#') && line.trim());
            
            if (lines.length === 0) {
                return null;
            }

            // Parse request line (method + URL)
            const requestLine = lines[0].trim();
            const [method, fullUrl] = requestLine.split(' ', 2);

            if (!method || !fullUrl) {
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
            }

            // Parse headers
            const headers: Record<string, string> = {};
            let bodyStartIndex = -1;

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                
                if (line === '' || line.startsWith('{') || line.startsWith('[')) {
                    bodyStartIndex = i;
                    break;
                }

                const colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                    const key = line.substring(0, colonIndex).trim();
                    const value = line.substring(colonIndex + 1).trim();
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
     * Execute HTTP request
     */
    async executeRequest(request: HttpRequest): Promise<HttpResponse> {
        const startTime = Date.now();
        
        try {
            this.outputChannel.appendLine(`Executing ${request.method} ${request.url}`);
            
            // Build fetch options
            const fetchOptions: RequestInit = {
                method: request.method,
                headers: request.headers
            };

            // Add body for non-GET requests
            if (request.body && !['GET', 'HEAD'].includes(request.method)) {
                fetchOptions.body = request.body;
            }

            // Build final URL with query parameters
            let finalUrl = request.url;
            if (request.queryParams) {
                const params = new URLSearchParams(request.queryParams);
                finalUrl += `?${params.toString()}`;
            }

            // Execute request
            const response = await fetch(finalUrl, fetchOptions);
            const responseBody = await response.text();
            const endTime = Date.now();

            // Convert headers to object
            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            const httpResponse: HttpResponse = {
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders,
                body: responseBody,
                responseTime: endTime - startTime,
                size: new Blob([responseBody]).size
            };

            this.outputChannel.appendLine(`Response: ${response.status} ${response.statusText} (${httpResponse.responseTime}ms)`);
            
            return httpResponse;

        } catch (error) {
            const endTime = Date.now();
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            this.outputChannel.appendLine(`Request failed: ${errorMessage}`);
            
            return {
                status: 0,
                statusText: 'Request Failed',
                headers: {},
                body: `Error: ${errorMessage}`,
                responseTime: endTime - startTime,
                size: 0
            };
        }
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
    }

    /**
     * Open HTTP request editor
     */
    async openRequestEditor(endpoint: EndpointInfo, environment: ApiEnvironment): Promise<void> {
        try {
            const skeleton = this.generateRequestSkeleton(endpoint, environment);
            
            // Create new untitled document
            const document = await vscode.workspace.openTextDocument({
                content: skeleton,
                language: 'http'
            });

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
    }

    /**
     * Display response in new tab
     */
    async displayResponse(response: HttpResponse, originalRequest: HttpRequest): Promise<void> {
        try {
            const formattedResponse = this.formatResponse(response, originalRequest);
            
            // Create new untitled document for response
            const document = await vscode.workspace.openTextDocument({
                content: formattedResponse,
                language: 'markdown'
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
    }    private formatBytes(bytes: number): string {
        if (bytes === 0) {
            return '0 B';
        }
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}
