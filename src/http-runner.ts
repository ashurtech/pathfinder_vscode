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

/**
 * Webview-based response viewer
 */
class ResponseViewer {
    private panel: vscode.WebviewPanel | undefined;
    private disposables: vscode.Disposable[] = [];
    private httpRunner: HttpRequestRunner;

    constructor(httpRunner: HttpRequestRunner) {
        this.disposables = [];
        this.httpRunner = httpRunner;
    }

    dispose() {
        if (this.panel) {
            this.panel.dispose();
        }
        this.disposables.forEach(d => d.dispose());
    }

    async showResponse(response: HttpResponse, request: HttpRequest) {
        if (this.panel) {
            this.panel.dispose();
        }

        this.panel = vscode.window.createWebviewPanel(
            'apiResponse',
            'API Response',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getWebviewContent(response, request);

        this.panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'copyResponse':
                        await vscode.env.clipboard.writeText(response.body);
                        vscode.window.showInformationMessage('Response copied to clipboard');
                        break;
                    case 'requestYaml':
                        try {
                            const yamlResponse = await this.requestYamlResponse(request);
                            if (yamlResponse) {
                                this.panel?.webview.postMessage({ 
                                    command: 'updateResponse',
                                    response: yamlResponse
                                });
                            }
                        } catch (error) {
                            vscode.window.showErrorMessage(`Failed to get YAML response: ${error}`);
                        }
                        break;
                }
            },
            null,
            this.disposables
        );

        this.panel.onDidDispose(
            () => {
                this.panel = undefined;
            },
            null,
            this.disposables
        );
    }

    private async requestYamlResponse(request: HttpRequest): Promise<HttpResponse | null> {
        try {
            // Create a new request with Accept header for YAML
            const yamlRequest: HttpRequest = {
                ...request,
                headers: {
                    ...request.headers,
                    'Accept': 'application/yaml'
                }
            };

            // Execute the request
            const response = await this.executeRequest(yamlRequest);
            return response;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to get YAML response: ${error}`);
            return null;
        }
    }

    private getWebviewContent(response: HttpResponse, request: HttpRequest): string {
        const isJson = response.headers['content-type']?.includes('application/json');
        const isYaml = response.headers['content-type']?.includes('application/yaml');
        const statusColor = response.status >= 200 && response.status < 300 ? '#4CAF50' : '#F44336';
        const formattedHeaders = Object.entries(response.headers)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
        
        let formattedBody = response.body;
        let bodyLanguage = 'plaintext';
        
        if (isJson) {
            try {
                formattedBody = JSON.stringify(JSON.parse(response.body), null, 2);
                bodyLanguage = 'json';
            } catch (e) {
                // Keep original if not valid JSON
            }
        } else if (isYaml) {
            bodyLanguage = 'yaml';
        }

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/vs2015.min.css">
                <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/json.min.js"></script>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/yaml.min.js"></script>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/jmespath/0.16.0/jmespath.min.js"></script>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                        color: var(--vscode-editor-foreground);
                        background: var(--vscode-editor-background);
                        line-height: 1.5;
                    }
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                    }
                    .status {
                        font-size: 1.2em;
                        font-weight: bold;
                        margin-bottom: 15px;
                        padding: 10px;
                        border-radius: 4px;
                        background: var(--vscode-editor-inactiveSelectionBackground);
                    }
                    .section {
                        margin-bottom: 20px;
                        background: var(--vscode-editor-inactiveSelectionBackground);
                        padding: 15px;
                        border-radius: 4px;
                    }
                    .section-title {
                        font-weight: bold;
                        margin-bottom: 10px;
                        color: var(--vscode-textLink-foreground);
                    }
                    .headers {
                        white-space: pre-wrap;
                        font-family: var(--vscode-editor-font-family);
                    }
                    .body {
                        white-space: pre-wrap;
                        font-family: var(--vscode-editor-font-family);
                    }
                    .button-group {
                        position: absolute;
                        top: 10px;
                        right: 10px;
                        display: flex;
                        gap: 10px;
                    }
                    .button {
                        padding: 5px 10px;
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 0.9em;
                    }
                    .button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    .query-section {
                        margin: 20px 0;
                        padding: 15px;
                        background: var(--vscode-editor-inactiveSelectionBackground);
                        border-radius: 4px;
                    }
                    .query-input {
                        width: 100%;
                        padding: 8px;
                        margin: 5px 0;
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 4px;
                        font-family: var(--vscode-editor-font-family);
                    }
                    .error {
                        color: var(--vscode-errorForeground);
                        margin: 5px 0;
                        padding: 5px;
                        background: var(--vscode-inputValidation-errorBackground);
                        border-radius: 4px;
                    }
                    .result {
                        margin-top: 10px;
                        padding: 10px;
                        background: var(--vscode-editor-background);
                        border-radius: 4px;
                        border: 1px solid var(--vscode-input-border);
                    }
                    /* Override highlight.js theme to match VS Code */
                    .hljs {
                        background: var(--vscode-editor-background) !important;
                        color: var(--vscode-editor-foreground) !important;
                        padding: 0 !important;
                    }
                    .hljs-string { color: #ce9178 !important; }
                    .hljs-number { color: #b5cea8 !important; }
                    .hljs-boolean { color: #569cd6 !important; }
                    .hljs-null { color: #569cd6 !important; }
                    .hljs-keyword { color: #c586c0 !important; }
                    .hljs-property { color: #9cdcfe !important; }
                    .hljs-comment { color: #6a9955 !important; }
                    .hljs-attr { color: #9cdcfe !important; }
                    .hljs-literal { color: #569cd6 !important; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="status" style="color: ${statusColor}">
                        HTTP ${response.status} - ${response.statusText}
                    </div>

                    <div class="section">
                        <div class="section-title">Request</div>
                        <div>${request.method} ${request.url}</div>
                        <div>Response Time: ${response.responseTime}ms</div>
                    </div>

                    <div class="section">
                        <div class="section-title">Headers</div>
                        <pre class="headers"><code class="language-plaintext">${this.escapeHtml(formattedHeaders)}</code></pre>
                    </div>

                    <div class="section">
                        <div class="section-title">Body</div>
                        <div class="button-group">
                            <button class="button" onclick="copyResponse()">Copy</button>
                            <button class="button" onclick="requestYaml()">Request YAML</button>
                        </div>
                        <pre class="body"><code class="language-${bodyLanguage}">${this.escapeHtml(formattedBody)}</code></pre>
                    </div>

                    ${isJson ? `
                    <div class="query-section">
                        <div class="section-title">Query Response</div>
                        <input type="text" class="query-input" id="jmespath" placeholder="Enter JMESPath query...">
                        <div style="margin-top: 10px;">
                            <button class="button" onclick="applyJMESPath()">Apply JMESPath</button>
                            <button class="button" onclick="applyRegex()">Apply Regex</button>
                        </div>
                        <div id="queryError" class="error"></div>
                        <div id="queryResult" class="result"></div>
                    </div>
                    ` : ''}
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    
                    // Initialize syntax highlighting
                    document.addEventListener('DOMContentLoaded', (event) => {
                        document.querySelectorAll('pre code').forEach((block) => {
                            hljs.highlightElement(block);
                        });
                    });

                    function copyResponse() {
                        vscode.postMessage({ command: 'copyResponse' });
                    }

                    function requestYaml() {
                        vscode.postMessage({ command: 'requestYaml' });
                    }

                    function applyJMESPath() {
                        const query = document.getElementById('jmespath').value;
                        try {
                            const result = jmespath.search(JSON.parse(${JSON.stringify(response.body)}), query);
                            const formattedResult = JSON.stringify(result, null, 2);
                            document.getElementById('queryResult').innerHTML = '<pre><code class="language-json">' + 
                                hljs.highlight(formattedResult, {language: 'json'}).value + 
                                '</code></pre>';
                            document.getElementById('queryError').textContent = '';
                        } catch (error) {
                            document.getElementById('queryError').textContent = error.message;
                            document.getElementById('queryResult').innerHTML = '';
                        }
                    }

                    function applyRegex() {
                        const query = document.getElementById('jmespath').value;
                        try {
                            const regex = new RegExp(query);
                            const matches = ${JSON.stringify(response.body)}.match(regex);
                            if (matches) {
                                document.getElementById('queryResult').innerHTML = '<pre><code class="language-plaintext">' + 
                                    matches.map(m => hljs.highlight(m, {language: 'plaintext'}).value).join('\\n') + 
                                    '</code></pre>';
                            } else {
                                document.getElementById('queryResult').textContent = 'No matches found';
                            }
                            document.getElementById('queryError').textContent = '';
                        } catch (error) {
                            document.getElementById('queryError').textContent = error.message;
                            document.getElementById('queryResult').innerHTML = '';
                        }
                    }

                    // Handle messages from the extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'updateResponse':
                                const bodyElement = document.querySelector('.body code');
                                bodyElement.textContent = message.response.body;
                                bodyElement.className = 'language-yaml';
                                hljs.highlightElement(bodyElement);
                                break;
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    private async executeRequest(request: HttpRequest): Promise<HttpResponse> {
        return await this.httpRunner.executeRequest(request);
    }
}

interface RequestHistoryItem {
    timestamp: number;
    request: HttpRequest;
    response: HttpResponse;
}

class RequestHistoryProvider implements vscode.TreeDataProvider<RequestHistoryItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<RequestHistoryItem | undefined> = new vscode.EventEmitter<RequestHistoryItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<RequestHistoryItem | undefined> = this._onDidChangeTreeData.event;

    private history: RequestHistoryItem[] = [];
    private maxHistoryItems = 50;

    constructor() {
        // Initialize with empty history
    }

    getTreeItem(element: RequestHistoryItem): vscode.TreeItem {
        const item = new vscode.TreeItem(
            `${element.request.method} ${element.request.url}`,
            vscode.TreeItemCollapsibleState.None
        );
        
        item.tooltip = `Status: ${element.response.status} - ${element.response.statusText}\nTime: ${element.response.responseTime}ms`;
        item.description = `${element.response.status} - ${new Date(element.timestamp).toLocaleTimeString()}`;
        item.iconPath = element.response.status >= 200 && element.response.status < 300 ? 
            new vscode.ThemeIcon('check') : 
            new vscode.ThemeIcon('error');
        
        item.command = {
            command: 'pathfinder.showRequestHistory',
            title: 'Show Request History',
            arguments: [element]
        };

        return item;
    }

    getChildren(): RequestHistoryItem[] {
        return this.history;
    }

    addToHistory(request: HttpRequest, response: HttpResponse) {
        const item: RequestHistoryItem = {
            timestamp: Date.now(),
            request,
            response
        };

        this.history.unshift(item);
        if (this.history.length > this.maxHistoryItems) {
            this.history.pop();
        }

        this._onDidChangeTreeData.fire(undefined);
    }

    clearHistory() {
        this.history = [];
        this._onDidChangeTreeData.fire(undefined);
    }
}

export class HttpRequestRunner {
    private readonly outputChannel: vscode.OutputChannel;
    private readonly credentialStore: Map<string, Record<string, string>> = new Map();
    private readonly configManager: ConfigurationManager;
    private readonly responseViewer: ResponseViewer;
    private requestHistory: RequestHistoryProvider;

    constructor(configManager: ConfigurationManager) {
        this.configManager = configManager;
        this.outputChannel = vscode.window.createOutputChannel('Pathfinder HTTP Runner');
        this.responseViewer = new ResponseViewer(this);
        this.requestHistory = new RequestHistoryProvider();
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
        if (environment.auth?.type === 'bearer' && environment.auth.bearerToken) {
            const maskedToken = this.maskSensitiveValue(environment.auth.bearerToken);
            headers.push(`Authorization: Bearer ${maskedToken} # 👁️ Click to toggle visibility`);
        } else if (environment.auth?.type === 'apikey' && environment.auth.apiKey) {
            const maskedKey = this.maskSensitiveValue(environment.auth.apiKey);
            headers.push(`X-API-Key: ${maskedKey} # 👁️ Click to toggle visibility`);
        } else if (environment.auth?.type === 'basic' && environment.auth.username && environment.auth.password) {
            const credentials = Buffer.from(`${environment.auth.username}:${environment.auth.password}`).toString('base64');
            const maskedCredentials = this.maskSensitiveValue(credentials);
            headers.push(`Authorization: Basic ${maskedCredentials} # 👁️ Click to toggle visibility`);
        }

        // Generate request body for POST/PUT/PATCH
        let bodySection = '';
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
            bodySection = `
{
  "example": "value"
  // Add your request body here
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
# Environment ID: ${environment.id}
# Environment Name: ${environment.name}
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
        const match = content.match(/^# Environment ID: (.+)$/m);
        if (match) {
            request.environmentId = match[1].trim();
        }

        // Add stored credentials to headers
        const storedCredentials = this.getStoredCredentials(documentUri);
        if (storedCredentials) {
            request.headers = {
                ...request.headers,
                ...storedCredentials
            };
        }

        return request;
    }

    /**
     * Execute an HTTP request with resolved environment configuration
     */
    async executeRequest(request: HttpRequest): Promise<HttpResponse> {
        if (!request.environmentId) {
            throw new Error('Environment ID is required to execute request');
        }

        // Get environment configuration
        const config = await this.configManager.resolveEnvironmentConfig(request.environmentId);
        if (!config) {
            throw new Error('Environment not found, not good, friendo');
        }

        // Merge headers
        const headers = {
            ...config.resolvedHeaders,
            ...request.headers
        };

        // Get credentials from secret storage
        const credentials = await this.configManager.getCredentials(config.environment);
        
        // Add authentication headers from environment config and credentials
        if (config.resolvedAuth) {
            if (config.resolvedAuth.type === 'bearer' && credentials?.apiKey) {
                headers['Authorization'] = `Bearer ${credentials.apiKey}`;
            } else if (config.resolvedAuth.type === 'apikey' && credentials?.apiKey) {
                headers['X-API-Key'] = credentials.apiKey;
            } else if (config.resolvedAuth.type === 'basic' && credentials?.username && credentials?.password) {
                const authString = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
                headers['Authorization'] = `Basic ${authString}`;
            }
        }

        // Construct URL with query parameters
        let url = request.url;
        if (request.queryParams && Object.keys(request.queryParams).length > 0) {
            const queryString = new URLSearchParams(request.queryParams).toString();
            url = `${url}${url.includes('?') ? '&' : '?'}${queryString}`;
        }

        // Make the request
        const startTime = Date.now();
        try {
            this.outputChannel.appendLine(`Making ${request.method} request to ${url}`);
            this.outputChannel.appendLine('Headers: ' + JSON.stringify(headers, null, 2));
            if (request.body) {
                this.outputChannel.appendLine('Body: ' + request.body);
            }

            const response = await fetch(url, {
                method: request.method,
                headers: headers,
                body: request.body
            });

            const responseBody = await response.text();
            const endTime = Date.now();

            this.outputChannel.appendLine(`Response status: ${response.status} ${response.statusText}`);
            this.outputChannel.appendLine('Response headers: ' + JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
            this.outputChannel.appendLine('Response body: ' + responseBody);

            const httpResponse: HttpResponse = {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                body: responseBody,
                responseTime: endTime - startTime,
                size: responseBody.length
            };

            // Add to history after successful request
            this.requestHistory.addToHistory(request, httpResponse);
            return httpResponse;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`Request failed: ${errorMessage}`);
            throw new Error(`Failed to execute request: ${errorMessage}`);
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
    }    /**
     * Open HTTP request editor
     */
    async openRequestEditor(endpoint: EndpointInfo, environment: any, platformConfig?: any): Promise<void> {
        try {
            const skeleton = this.generateRequestSkeleton(endpoint, environment, platformConfig);
              // Create new untitled document
            const document = await vscode.workspace.openTextDocument({
                content: skeleton,
                language: 'http'
            });
            
            // Store credentials securely for this document
            const credentials: Record<string, string> = {};            // For schema-first environments, get credentials from secrets storage
            if (environment.authSecretKey && environment.auth) {
                try {
                    const storedCredentials = await this.configManager.getCredentials(environment);
                    if (storedCredentials) {
                        if (environment.auth.type === 'bearer' && storedCredentials.apiKey) {
                            credentials['Authorization'] = `Bearer ${storedCredentials.apiKey}`;
                        } else if (environment.auth.type === 'apikey' && storedCredentials.apiKey) {
                            const headerName = environment.auth.apiKeyName ?? 'X-API-Key';
                            credentials[headerName] = storedCredentials.apiKey;
                        } else if (environment.auth.type === 'basic' && storedCredentials.username && storedCredentials.password) {
                            const basicCredentials = Buffer.from(`${storedCredentials.username}:${storedCredentials.password}`).toString('base64');
                            credentials['Authorization'] = `Basic ${basicCredentials}`;
                        }
                    }
                } catch (error) {
                    console.error('Error retrieving credentials from secrets storage:', error);
                    // Fall back to legacy auth structure if secrets retrieval fails
                    this.handleLegacyAuth(environment, credentials);
                }
            } else if (environment.auth) {
                // Handle legacy auth structure for backward compatibility
                this.handleLegacyAuth(environment, credentials);
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
            this.outputChannel.appendLine(`Error opening request editor: ${errorMessage}`);        }
    }

    /**
     * Handle legacy auth structure for backward compatibility
     */
    private handleLegacyAuth(environment: any, credentials: Record<string, string>): void {
        if (environment.auth?.type === 'bearer' && environment.auth?.bearerToken) {
            credentials['Authorization'] = `Bearer ${environment.auth.bearerToken}`;
        } else if (environment.auth?.type === 'apikey' && environment.auth?.apiKey) {
            const headerName = environment.auth?.apiKeyName ?? 'X-API-Key';
            credentials[headerName] = environment.auth.apiKey;
        } else if (environment.auth?.type === 'basic' && environment.auth?.username && environment.auth?.password) {
            const basicCredentials = Buffer.from(`${environment.auth.username}:${environment.auth.password}`).toString('base64');
            credentials['Authorization'] = `Basic ${basicCredentials}`;
        }
    }

    /**
     * Display response in webview
     */
    async displayResponse(response: HttpResponse, originalRequest: HttpRequest): Promise<void> {
        try {
            await this.responseViewer.showResponse(response, originalRequest);
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

    getRequestHistoryProvider(): RequestHistoryProvider {
        return this.requestHistory;
    }    getResponseViewer(): ResponseViewer {
        return this.responseViewer;
    }
}
