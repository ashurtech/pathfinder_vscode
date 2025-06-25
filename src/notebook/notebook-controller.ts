/**
 * NotebookController - Core controller for HTTP request notebooks
 * 
 * This class manages the lifecycle of HTTP request notebooks, including:
 * - Creating new notebooks from API endpoints
 * - Executing HTTP cells within notebooks
 * - Managing variable context between cells
 * - Providing the notebook execution environment
 */

import * as vscode from 'vscode';
import { ConfigurationManager } from '../configuration';
import { EndpointInfo, SchemaEnvironment } from '../types';
import { HttpRequestExecutor, HttpExecutionResult, ParsedHttpRequest } from './http-request-executor';
import { HttpRequestParser } from './http-request-parser';
import { NotebookRequestHistoryProvider } from './notebook-request-history';
import { GroupExecutor, RequestTemplate, GroupExecutionResult } from './group-executor';
import { EnvironmentSelectorWebview } from '../webviews/environment-selector';
import { ResponseHandler } from '../response-handler';

/**
 * Represents the structure of a notebook cell in our XML format
 */
export interface NotebookCellData {
    kind: vscode.NotebookCellKind;
    languageId: string;
    value: string;
    metadata?: Record<string, any>;
}

/**
 * Represents the complete notebook document data
 */
export interface NotebookDocumentData {
    cells: NotebookCellData[];
    metadata?: Record<string, any>;
}

/**
 * Context variables available for substitution in HTTP requests
 */
export interface VariableContext {
    [key: string]: any;
}

export class NotebookController {
    private readonly controller: vscode.NotebookController;
    private readonly httpExecutor: HttpRequestExecutor;
    private readonly httpParser: HttpRequestParser;
    private readonly requestHistory: NotebookRequestHistoryProvider;
    private readonly groupExecutor: GroupExecutor;
    private variableContext: VariableContext = {};

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly configManager: ConfigurationManager
    ) {
        // Initialize request history
        this.requestHistory = new NotebookRequestHistoryProvider(context);
        
        // Create the notebook controller for HTTP requests
        this.controller = vscode.notebooks.createNotebookController(
            'pathfinder-http-notebook',
            'pathfinder-http-notebook',
            'Pathfinder HTTP (▶️ Run Requests)'
        );

        this.controller.supportedLanguages = ['http', 'markdown', 'json'];
        this.controller.supportsExecutionOrder = true;
        this.controller.executeHandler = this.executeCell.bind(this);

        // Initialize HTTP execution components
        this.httpExecutor = new HttpRequestExecutor(configManager);
        this.httpParser = new HttpRequestParser();
        this.groupExecutor = new GroupExecutor(this, configManager);

        // Register the controller
        this.context.subscriptions.push(this.controller);
    }    /**
     * Creates a new notebook document from an API endpoint
     */
    async createNotebookFromEndpoint(
        endpoint: EndpointInfo,
        schemaId: string,
        environmentId?: string
    ): Promise<vscode.NotebookDocument> {
        // Initialize variable context with environment data
        await this.initializeVariableContext(schemaId, environmentId);
        
        const cells = await this.generateCellsForEndpoint(endpoint, schemaId, environmentId);
        
        const notebookData = new vscode.NotebookData(cells);
        notebookData.metadata = {
            pathfinder: {
                schemaId,
                environmentId,
                endpoint: {
                    path: endpoint.path,
                    method: endpoint.method,
                    operationId: endpoint.operationId
                }
            }
        };        const notebook = await vscode.workspace.openNotebookDocument('pathfinder-http-notebook', notebookData);
        
        return notebook;
    }/**
     * Alias for createNotebookFromEndpoint to match test expectations
     */
    async createNotebookForEndpoint(
        endpoint: EndpointInfo,
        environment: SchemaEnvironment
    ): Promise<vscode.NotebookDocument> {
        const notebook = await this.createNotebookFromEndpoint(endpoint, 'default', environment.id);
        await this.openNotebook(notebook);
        return notebook;
    }

    /**
     * Opens a notebook in the editor
     */
    async openNotebook(notebook: vscode.NotebookDocument): Promise<void> {
        await vscode.window.showNotebookDocument(notebook, { viewColumn: vscode.ViewColumn.One });
    }    /**
     * Executes a single notebook cell
     */
    private async executeCell(
        cells: vscode.NotebookCell[],
        notebook: vscode.NotebookDocument,
        controller: vscode.NotebookController
    ): Promise<void> {
        // Ensure variable context is restored from notebook metadata before execution
        await this.restoreVariableContextFromNotebook(notebook);
        
        for (const cell of cells) {
            await this.executeSingleCell(cell, notebook);
        }
    }/**
     * Executes a single cell based on its language
     */
    private async executeSingleCell(
        cell: vscode.NotebookCell,
        notebook: vscode.NotebookDocument
    ): Promise<void> {
        const execution = this.controller.createNotebookCellExecution(cell);
        execution.start(Date.now());

        try {
            // Check if the cell is being executed with the correct controller
            if (!this.isCellSupportedByController(cell)) {
                await this.handleUnsupportedCell(cell, execution);
                return;
            }

            switch (cell.document.languageId) {
                case 'http':
                    await this.executeHttpCell(cell, execution);
                    break;
                case 'markdown':
                    // Markdown cells don't need execution
                    execution.end(true, Date.now());
                    break;
                case 'json':
                    await this.executeJsonCell(cell, execution);
                    break;
                default:
                    await this.handleUnsupportedLanguage(cell, execution);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            execution.replaceOutput(new vscode.NotebookCellOutput([
                vscode.NotebookCellOutputItem.error(new Error(errorMessage))
            ]));
            execution.end(false, Date.now());
        }
    }

    /**
     * Checks if a cell is supported by this controller
     */
    private isCellSupportedByController(cell: vscode.NotebookCell): boolean {
        const supportedLanguages = ['http', 'markdown', 'json'];
        return supportedLanguages.includes(cell.document.languageId);
    }

    /**
     * Handles cells that are not supported by this controller
     */
    private async handleUnsupportedCell(
        cell: vscode.NotebookCell,
        execution: vscode.NotebookCellExecution
    ): Promise<void> {
        const language = cell.document.languageId;
        const cellContent = cell.document.getText().trim();
        
        // Try to detect if this looks like an HTTP request
        const looksLikeHttp = this.detectHttpContent(cellContent);
        
        let message = `❌ **Cell Language Issue**\n\n`;
        message += `This cell has language '${language}' but the Pathfinder HTTP controller only supports: **http**, **json**, and **markdown**.\n\n`;
        
        if (looksLikeHttp) {
            message += `🔍 **Detected HTTP Content**\n`;
            message += `This cell appears to contain an HTTP request. To execute it:\n\n`;
            message += `1. **Change the cell language to 'http'**: Click the language selector in the bottom-right of the cell and select 'HTTP'\n`;
            message += `2. **Run the cell again**: Click the play button or press Ctrl+Enter\n\n`;
            message += `💡 **Tip**: All HTTP request cells in Pathfinder notebooks should use the 'http' language for proper syntax highlighting and execution.`;
        } else {
            message += `**To fix this:**\n`;
            message += `- For HTTP requests: Change cell language to **'http'**\n`;
            message += `- For variables/JSON data: Change cell language to **'json'**\n`;
            message += `- For documentation: Change cell language to **'markdown'**\n\n`;
            message += `Click the language selector in the bottom-right corner of the cell to change it.`;
        }

        execution.replaceOutput([
            new vscode.NotebookCellOutput([
                vscode.NotebookCellOutputItem.text(message, 'text/markdown')
            ])
        ]);
        execution.end(false, Date.now());
    }

    /**
     * Handles cells with unsupported languages within our controller
     */
    private async handleUnsupportedLanguage(
        cell: vscode.NotebookCell,
        execution: vscode.NotebookCellExecution
    ): Promise<void> {
        const language = cell.document.languageId;
        const cellContent = cell.document.getText().trim();
        
        let message = `⚠️ **Unsupported Language: '${language}'**\n\n`;
        message += `The Pathfinder HTTP Notebook controller supports these languages:\n`;
        message += `- **http**: For HTTP requests\n`;
        message += `- **json**: For variables and JSON data\n`;
        message += `- **markdown**: For documentation\n\n`;
        
        // Try to provide intelligent suggestions
        if (this.detectHttpContent(cellContent)) {
            message += `🔍 **Suggestion**: This looks like an HTTP request. Change the cell language to **'http'**.`;
        } else if (this.detectJsonContent(cellContent)) {
            message += `🔍 **Suggestion**: This looks like JSON data. Change the cell language to **'json'**.`;
        } else {
            message += `**To change the language**: Click the language selector in the bottom-right corner of the cell.`;
        }

        execution.replaceOutput([
            new vscode.NotebookCellOutput([
                vscode.NotebookCellOutputItem.text(message, 'text/markdown')
            ])
        ]);
        execution.end(false, Date.now());
    }    /**
     * Detects if content looks like an HTTP request
     */
    private detectHttpContent(content: string): boolean {
        const trimmed = content.trim();
        if (!trimmed) {
            return false;
        }
        
        // Check for HTTP methods at the start of the content
        const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
        const firstLine = trimmed.split('\n')[0].trim().toUpperCase();
        
        return httpMethods.some(method => firstLine.startsWith(method + ' '));
    }

    /**
     * Detects if content looks like JSON
     */
    private detectJsonContent(content: string): boolean {
        const trimmed = content.trim();
        if (!trimmed) {
            return false;
        }
        
        try {
            JSON.parse(trimmed);
            return true;
        } catch {
            return false;
        }
    }    /**
     * Executes an HTTP cell
     */    private async executeHttpCell(
        cell: vscode.NotebookCell,
        execution: vscode.NotebookCellExecution
    ): Promise<void> {
        const startTime = Date.now();
        const httpContent = cell.document.getText();
        const parsedRequest = this.httpParser.parseHttpRequest(httpContent, this.variableContext);
        
        // Add environment metadata from notebook if available
        const notebook = vscode.window.activeNotebookEditor?.notebook;
        const metadata = notebook?.metadata?.pathfinder;
        if (metadata?.environmentId) {
            parsedRequest.metadata = {
                ...parsedRequest.metadata,
                environmentId: metadata.environmentId,
                schemaId: metadata.schemaId
            };
        }
        
        // Confirm DELETE requests before execution
        if (parsedRequest.method.toUpperCase() === 'DELETE') {
            const confirmed = await this.confirmDeleteRequest(parsedRequest);
            if (!confirmed) {
                // User cancelled - create a cancellation output
                execution.replaceOutput([
                    new vscode.NotebookCellOutput([
                        vscode.NotebookCellOutputItem.text(
                            '⚠️ DELETE request cancelled by user\n\nThe HTTP DELETE request was not executed to prevent accidental data deletion.',
                            'text/plain'
                        )
                    ])
                ]);
                execution.end(true, Date.now());
                return;
            }
        }
        
        const result = await this.httpExecutor.executeRequest(parsedRequest);
        const executionDuration = Date.now() - startTime;
        
        // Track this request in history
        const cellIndex = notebook?.getCells().indexOf(cell);
        this.requestHistory.addToHistory(
            parsedRequest,
            result,
            notebook,
            cellIndex,
            { ...this.variableContext },
            executionDuration
        );
        
        // Update variable context with response data
        if (result.data && typeof result.data === 'object') {
            this.variableContext = { ...this.variableContext, ...result.data };
        }// Create detailed outputs showing both request and response
        const requestDetails = this.formatRequestDetails(parsedRequest);
        const responseDetails = this.formatResponseDetails(result);

        const outputs = [
            // Request details (collapsed by default)
            new vscode.NotebookCellOutput([
                vscode.NotebookCellOutputItem.text(
                    `📤 REQUEST DETAILS\n${'='.repeat(50)}\n${requestDetails}`,
                    'text/plain'
                )
            ]),
            // Response details
            new vscode.NotebookCellOutput([
                vscode.NotebookCellOutputItem.text(
                    `📥 RESPONSE\n${'='.repeat(50)}\n${responseDetails}`,
                    'text/plain'
                )
            ])        ];

        // Use ResponseHandler for smart response handling
        try {
            const responseOutput = await ResponseHandler.handleApiResponse(result.body, cell.document.uri);
            outputs.push(responseOutput);
        } catch (error) {
            console.error('Failed to handle API response:', error);
            // Fallback to simple JSON output
            if (result.body) {
                outputs.push(new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.json(result, 'application/json')
                ]));
            }
        }

        execution.replaceOutput(outputs);
        execution.end(true, Date.now());
    }

    /**
     * Executes a JSON cell (typically for setting variables)
     */
    private async executeJsonCell(
        cell: vscode.NotebookCell,
        execution: vscode.NotebookCellExecution
    ): Promise<void> {
        const jsonContent = cell.document.getText();
        
        try {
            const data = JSON.parse(jsonContent);
            // Merge JSON data into variable context
            this.variableContext = { ...this.variableContext, ...data };
            
            execution.replaceOutput([
                new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.text('Variables updated successfully', 'text/plain')
                ])
            ]);
            execution.end(true, Date.now());
        } catch (error) {
            throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Generates notebook cells for a given endpoint
     */    private async generateCellsForEndpoint(
        endpoint: EndpointInfo,
        schemaId: string,
        environmentId?: string
    ): Promise<vscode.NotebookCellData[]> {
        const cells: vscode.NotebookCellData[] = [];        // Add title cell with endpoint description including category and method
        const category = endpoint.tags && endpoint.tags.length > 0 ? endpoint.tags[0] : 'API';
        const method = endpoint.method.toUpperCase();
        const endpointTitle = endpoint.summary ?? `${method} ${endpoint.path}`;
        const title = `${category} - ${endpointTitle} - ${method}`;
        const description = endpoint.description ?? 'No description available';
        cells.push(new vscode.NotebookCellData(
            vscode.NotebookCellKind.Markup,
            `# ${title}\n\n${description}`,
            'markdown'
        ));

        // Add endpoint details (parameters, etc.) - collapsed by default
        const detailsMarkdown = await this.generateEndpointDetails(endpoint, schemaId, environmentId);
        if (detailsMarkdown) {
            cells.push(new vscode.NotebookCellData(
                vscode.NotebookCellKind.Markup,
                detailsMarkdown,
                'markdown'
            ));
        }

        // Add environment selection if multiple environments available
        const environments = await this.configManager.getSchemaEnvironments(schemaId);
        if (environments.length > 1) {
            cells.push(new vscode.NotebookCellData(
                vscode.NotebookCellKind.Markup,
                `## Environment\n\nCurrent: ${environmentId ? environments.find(e => e.id === environmentId)?.name ?? 'Unknown' : 'None selected'}`,
                'markdown'
            ));
        }        // Add variables cell with current context values (masked for security)
        const maskedContext = this.maskSensitiveVariables(this.variableContext);
        const variablesJson = JSON.stringify(maskedContext, null, 2);
        
        // Generate fallback template based on environment auth type
        let fallbackTemplate = '{\n  "baseUrl": "{{baseUrl}}"';
        if (environmentId) {
            const environment = await this.configManager.getSchemaEnvironment(environmentId);
            if (environment) {
                const credentials = await this.configManager.getCredentials(environment);
                
                // Determine auth type from environment config or infer from credentials
                let authType = environment.auth?.type;
                const authTypeString = authType as string;
                if (!authType || authTypeString === 'inherit') {
                    if (credentials) {
                        if (credentials.username && credentials.password) {
                            authType = 'basic';
                        } else if (credentials.apiKey) {
                            authType = 'apikey';
                        }
                    }
                }
                
                switch (authType) {
                    case 'basic':
                        fallbackTemplate += ',\n  "username": "{{username}}",\n  "password": "{{password}}"';
                        break;
                    case 'bearer':
                        fallbackTemplate += ',\n  "bearerToken": "{{bearerToken}}"';
                        break;
                    case 'apikey':
                        fallbackTemplate += ',\n  "apiKey": "{{apiKey}}"';
                        break;
                }
            }
        } else {
            fallbackTemplate += ',\n  "apiKey": "{{apiKey}}"';
        }
        fallbackTemplate += '\n}';
        
        cells.push(new vscode.NotebookCellData(
            vscode.NotebookCellKind.Code,
            variablesJson || fallbackTemplate,
            'json'
        ));        // Add HTTP request cell
        const httpRequest = await this.generateHttpRequest(endpoint, environmentId);
        cells.push(new vscode.NotebookCellData(
            vscode.NotebookCellKind.Code,
            httpRequest,
            'http'
        ));

        return cells;
    }

    /**
     * Generates endpoint details documentation
     */
    private async generateEndpointDetails(
        endpoint: EndpointInfo,
        schemaId: string,
        environmentId?: string
    ): Promise<string> {
        const sections: string[] = [];

        // Add parameters section
        const paramsSection = this.generateParametersSection(endpoint);
        if (paramsSection) {
            sections.push(paramsSection);
        }

        // Add request body section
        const bodySection = this.generateRequestBodySection(endpoint);
        if (bodySection) {
            sections.push(bodySection);
        }

        // Add response section
        const responseSection = this.generateResponseSection(endpoint);
        if (responseSection) {
            sections.push(responseSection);
        }

        return sections.join('\n');
    }

    /**
     * Generates parameters documentation section
     */
    private generateParametersSection(endpoint: EndpointInfo): string {
        if (!endpoint.parameters || endpoint.parameters.length === 0) {
            return '';
        }

        let section = '\n<details>\n<summary>📋 Parameters</summary>\n\n';
        
        const pathParams = endpoint.parameters.filter(p => p.in === 'path');
        const queryParams = endpoint.parameters.filter(p => p.in === 'query');
        const headerParams = endpoint.parameters.filter(p => p.in === 'header');
        
        if (pathParams.length > 0) {
            section += '### Path Parameters\n';
            section += this.formatParameters(pathParams);
        }
        
        if (queryParams.length > 0) {
            section += '### Query Parameters\n';
            section += this.formatParameters(queryParams);
        }
        
        if (headerParams.length > 0) {
            section += '### Header Parameters\n';
            section += this.formatParameters(headerParams);
        }
        
        section += '</details>\n';
        return section;
    }

    /**
     * Formats parameter list
     */
    private formatParameters(params: any[]): string {
        let formatted = '';
        for (const param of params) {
            const required = param.required ? ' **(required)**' : ' *(optional)*';
            formatted += `- **${param.name}**${required}: ${param.description ?? 'No description'}\n`;
        }
        return formatted + '\n';
    }

    /**
     * Generates request body documentation section
     */
    private generateRequestBodySection(endpoint: EndpointInfo): string {
        if (!['POST', 'PUT', 'PATCH'].includes(endpoint.method.toUpperCase())) {
            return '';
        }

        return '\n<details>\n<summary>📤 Request Body</summary>\n\n' +
               '```json\n{\n  "example": "data"\n}\n```\n' +
               '</details>\n';
    }

    /**
     * Generates response documentation section
     */
    private generateResponseSection(endpoint: EndpointInfo): string {
        return '\n<details>\n<summary>📥 Response Schema</summary>\n\n' +
               '**Success Response:**\n```json\n{\n  "result": "success"\n}\n```\n' +
               '</details>\n';
    }

    /**
     * Generates an HTTP request template for the endpoint
     */
    private async generateHttpRequest(endpoint: EndpointInfo, environmentId?: string): Promise<string> {
        let request = `${endpoint.method.toUpperCase()} {{baseUrl}}${endpoint.path}\n`;
        
        // Add common headers
        request += 'Content-Type: application/json\n';
        
        // Add authentication header based on environment configuration
        if (environmentId) {
            const environment = await this.configManager.getSchemaEnvironment(environmentId);
            
            if (environment) {
                // Get the actual credentials to determine auth type
                const credentials = await this.configManager.getCredentials(environment);
                
                // Determine auth type from environment config or infer from credentials
                let authType = environment.auth?.type;
                
                // Handle 'inherit' auth type or missing auth type by inferring from credentials
                // Cast to string to handle 'inherit' which isn't in the TypeScript type definition
                const authTypeString = authType as string;
                if (!authType || authTypeString === 'inherit') {
                    if (credentials) {
                        if (credentials.username && credentials.password) {
                            authType = 'basic';
                        } else if (credentials.apiKey) {
                            authType = 'apikey';
                        }
                    }
                }
                
                // Generate appropriate auth header
                switch (authType) {
                    case 'basic':
                        request += 'Authorization: Basic {{username}}:{{password}}\n';
                        break;
                    case 'bearer':
                        request += 'Authorization: Bearer {{bearerToken}}\n';
                        break;
                    case 'apikey':
                        if (environment.auth?.apiKeyLocation === 'header') {
                            const headerName = environment.auth.apiKeyName ?? 'X-API-Key';
                            request += `${headerName}: {{apiKey}}\n`;
                        } else {
                            // Default to X-API-Key if no specific location configured
                            request += 'X-API-Key: {{apiKey}}\n';
                        }
                        break;
                    // 'none' type and unhandled types don't add any auth headers
                }
            }
        }
        
        request += '\n';
        
        // Add request body for POST/PUT/PATCH
        if (['POST', 'PUT', 'PATCH'].includes(endpoint.method.toUpperCase())) {
            request += '{\n  "example": "data"\n}';
        }
        
        return request;
    }

    /**
     * Gets the current variable context
     */
    getVariableContext(): VariableContext {
        return { ...this.variableContext };
    }

    /**
     * Sets a variable in the context
     */
    setVariable(key: string, value: any): void {
        this.variableContext[key] = value;
    }

    /**
     * Clears all variables from the context
     */
    clearVariables(): void {
        this.variableContext = {};
    }

    /**
     * Disposes of the controller
     */
    dispose(): void {
        this.controller.dispose();
    }    /**
     * Executes multiple cells as expected by tests
     */
    async executeCells(
        cells: vscode.NotebookCell[],
        execution: vscode.NotebookCellExecution,
        context?: VariableContext
    ): Promise<void> {
        execution.start(Date.now());
        
        if (context) {
            this.variableContext = { ...this.variableContext, ...context };
        }

        try {
            for (const cell of cells) {
                await this.executeSingleCell(cell, cell.notebook);
            }
            execution.end(true, Date.now());
        } catch (error) {
            execution.end(false, Date.now());
            throw error;
        }
    }

    /**
     * Formats HTTP response for display
     */
    formatResponse(response: any): string {
        if (typeof response === 'string') {
            try {
                const parsed = JSON.parse(response);
                return JSON.stringify(parsed, null, 2);
            } catch {
                return response;
            }
        }
        
        if (typeof response === 'object' && response !== null) {
            return JSON.stringify(response, null, 2);
        }
        
        return String(response);
    }

    /**
     * Extracts variables from HTTP response
     */
    extractVariables(response: any): VariableContext {
        const variables: VariableContext = {};
        
        if (typeof response === 'object' && response !== null) {            // Extract common response fields as variables
            if (response.id) {
                variables.lastId = response.id;
            }
            if (response.token) {
                variables.authToken = response.token;
            }
            if (response.access_token) {
                variables.accessToken = response.access_token;
            }
            if (response.data) {
                variables.lastData = response.data;
            }
        }
        
        return variables;
    }

    /**
     * Formats request details for display
     */
    private formatRequestDetails(request: ParsedHttpRequest): string {
        let details = `Method: ${request.method}\n`;
        details += `URL: ${request.url}\n\n`;
        
        if (Object.keys(request.headers).length > 0) {
            details += 'Headers:\n';
            for (const [key, value] of Object.entries(request.headers)) {
                details += `  ${key}: ${value}\n`;
            }
            details += '\n';
        }
        
        if (request.body) {
            details += 'Body:\n';
            try {
                const formatted = JSON.stringify(JSON.parse(request.body), null, 2);
                details += formatted;
            } catch {
                details += request.body;
            }
        }
        
        return details;
    }    /**
     * Formats response details with size limits to avoid VS Code truncation UI
     */
    private formatResponseDetails(result: HttpExecutionResult): string {
        let details = `Status: ${result.status} ${result.statusText}\n`;
        
        // Handle both timing formats
        const timing = typeof result.timing === 'number' ? result.timing : result.timing.duration;
        details += `Time: ${timing}ms\n\n`;
        
        if (Object.keys(result.headers).length > 0) {
            details += 'Headers:\n';
            for (const [key, value] of Object.entries(result.headers)) {
                details += `  ${key}: ${value}\n`;
            }
            details += '\n';
        }
        
        if (result.body) {
            details += 'Body:\n';
            details += this.formatResponseBody(result.body);
        }
        
        return details;
    }    /**
     * Formats response body with appropriate limits for API exploration
     */
    private formatResponseBody(body: string): string {
        const bodySize = body.length;
        // Increased limit for better API exploration - users want to see more data
        const MAX_BODY_DISPLAY_SIZE = 50000; // 50KB for full display
        
        if (bodySize <= MAX_BODY_DISPLAY_SIZE) {
            return this.formatSmallResponseBody(body);
        } else {
            return this.formatLargeResponseBody(body, bodySize);
        }
    }

    /**
     * Formats small response bodies with full content
     */
    private formatSmallResponseBody(body: string): string {
        try {
            const parsed = JSON.parse(body);
            const formatted = JSON.stringify(parsed, null, 2);
            // Double-check formatted size doesn't exceed limits
            return formatted.length > 5000 ? 
                body.substring(0, 1000) + '\n\n...[response too large when formatted]' : 
                formatted;
        } catch {
            return body;
        }
    }    /**
     * Formats large response bodies with expanded preview
     */
    private formatLargeResponseBody(body: string, bodySize: number): string {
        const sizeMB = (bodySize / 1024 / 1024).toFixed(2);
        let result = `[Large Response - ${sizeMB}MB, ${bodySize.toLocaleString()} bytes]\n`;
        result += `Showing first 10,000 characters for better API exploration:\n\n`;
        
        try {
            // Check if it's valid JSON
            JSON.parse(body);
            result += body.substring(0, 10000) + '\n\n...[truncated - see JSON output below for full data if < 100KB]';
        } catch {
            result += body.substring(0, 10000) + '\n\n...[truncated - response too large for full display]';
        }
        
        return result;
    }/**
     * Initializes the variable context with environment data
     */
    private async initializeVariableContext(schemaId: string, environmentId?: string): Promise<void> {
        if (!environmentId) {
            return;
        }

        try {
            const environment = await this.configManager.getSchemaEnvironment(environmentId);
            if (environment) {
                // Set baseUrl from environment
                this.variableContext = {
                    ...this.variableContext,
                    baseUrl: environment.baseUrl
                };

                // Get credentials if available
                const credentials = await this.configManager.getCredentials(environment);
                if (credentials) {
                    if (credentials.apiKey) {
                        this.variableContext.apiKey = credentials.apiKey;
                    }
                    if (credentials.username && credentials.password) {
                        this.variableContext.username = credentials.username;
                        this.variableContext.password = credentials.password;
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to initialize variable context:', error);
        }
    }

    /**
     * Restores variable context when opening an existing notebook
     */
    async restoreVariableContextFromNotebook(notebook: vscode.NotebookDocument): Promise<void> {
        const metadata = notebook.metadata?.pathfinder;
        if (metadata?.schemaId && metadata?.environmentId) {
            await this.initializeVariableContext(metadata.schemaId, metadata.environmentId);
        }
    }    /**
     * Masks sensitive values in the variable context for display
     */
    private maskSensitiveVariables(context: VariableContext): VariableContext {
        // Only mask truly sensitive values, not username
        const sensitiveKeys = ['password', 'apikey', 'token', 'secret', 'auth', 'bearer', 'key'];
        const masked: VariableContext = {};
        
        for (const [key, value] of Object.entries(context)) {
            const keyLower = key.toLowerCase();
            const isSensitive = sensitiveKeys.some(sensitiveKey => keyLower.includes(sensitiveKey));
            
            if (isSensitive && typeof value === 'string' && value.length > 0) {
                // Show last character and mask the rest
                masked[key] = '*'.repeat(Math.max(0, value.length - 1)) + value.slice(-1);
            } else {
                masked[key] = value;
            }
        }
        
        return masked;
    }

    /**
     * Automatically detects and fixes cell languages in a notebook
     * This can be called as a command to help users fix language issues
     */
    async autoFixCellLanguages(notebook: vscode.NotebookDocument): Promise<void> {
        const edit = new vscode.WorkspaceEdit();
        let fixedCount = 0;

        for (let i = 0; i < notebook.cellCount; i++) {
            const cell = notebook.cellAt(i);
            const content = cell.document.getText().trim();
            const currentLanguage = cell.document.languageId;
            
            if (!content) {
                continue; // Skip empty cells
            }

            let suggestedLanguage: string | null = null;

            // Detect what language this cell should be
            if (this.detectHttpContent(content)) {
                suggestedLanguage = 'http';
            } else if (this.detectJsonContent(content)) {
                suggestedLanguage = 'json';
            } else if (this.detectMarkdownContent(content)) {
                suggestedLanguage = 'markdown';
            }

            // If we found a better language and it's different from current
            if (suggestedLanguage && suggestedLanguage !== currentLanguage) {
                const cellEdit = vscode.NotebookEdit.updateCellMetadata(i, {
                    ...cell.metadata,
                    languageId: suggestedLanguage
                });
                edit.set(notebook.uri, [cellEdit]);
                fixedCount++;
            }
        }

        if (fixedCount > 0) {
            await vscode.workspace.applyEdit(edit);
            vscode.window.showInformationMessage(
                `Fixed ${fixedCount} cell language${fixedCount === 1 ? '' : 's'} in the notebook.`
            );
        } else {
            vscode.window.showInformationMessage('No cell language issues found in this notebook.');
        }
    }    /**
     * Detects if content looks like markdown
     */
    private detectMarkdownContent(content: string): boolean {
        const trimmed = content.trim();
        if (!trimmed) {
            return false;
        }
        
        // Check for common markdown patterns
        const markdownPatterns = [
            /^#{1,6}\s+/, // Headers
            /^\*\*.*\*\*/, // Bold text
            /^\*.*\*/, // Italic text
            /^\[.*\]\(.*\)/, // Links
            /^>\s+/, // Blockquotes
            /^-\s+/, // Lists
            /^\d+\.\s+/, // Numbered lists
            /^```/ // Code blocks
        ];

        const lines = trimmed.split('\n');
        const firstLine = lines[0];
        
        return markdownPatterns.some(pattern => pattern.test(firstLine));
    }

    /**
     * Execute a request template across multiple environments
     */
    async executeAcrossEnvironments(template: RequestTemplate): Promise<void> {
        const environmentSelector = new EnvironmentSelectorWebview(this.context, this.configManager);
        
        try {
            const selection = await environmentSelector.show(template);
            
            if (!selection || !selection.confirmed || selection.selectedEnvironmentIds.length === 0) {
                vscode.window.showInformationMessage('Multi-environment execution cancelled');
                return;
            }

            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Executing request across environments',
                cancellable: false
            }, async (progress) => {
                let currentStep = 0;
                const totalSteps = selection.selectedEnvironmentIds.length;

                const result = await this.groupExecutor.executeAcrossEnvironments(
                    template,
                    selection.selectedEnvironmentIds,
                    (progressInfo) => {
                        progress.report({
                            message: `Processing ${progressInfo.environmentName} (${progressInfo.current}/${progressInfo.total})`,
                            increment: (100 / totalSteps)
                        });
                    }
                );

                // Show results summary
                await this.showGroupExecutionResults(result);
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to execute across environments: ${errorMessage}`);
        }
    }

    /**
     * Create a request template from the most recent notebook execution
     */
    async createTemplateFromLastExecution(notebookUri?: vscode.Uri): Promise<RequestTemplate | undefined> {
        const currentNotebook = notebookUri ? 
            vscode.workspace.notebookDocuments.find(nb => nb.uri.toString() === notebookUri.toString()) :
            vscode.window.activeNotebookEditor?.notebook;

        if (!currentNotebook) {
            vscode.window.showErrorMessage('No active notebook found');
            return undefined;
        }

        // Get the most recent history item for this notebook
        const history = this.requestHistory.getHistoryForNotebook(currentNotebook.uri.toString());
        if (history.length === 0) {
            vscode.window.showErrorMessage('No request history found for this notebook');
            return undefined;
        }

        const lastExecution = history[0]; // Most recent
        return this.groupExecutor.createRequestTemplate(lastExecution);
    }

    /**
     * Show the results of a group execution
     */
    private async showGroupExecutionResults(result: GroupExecutionResult): Promise<void> {
        const { summary, results } = result;
        
        // Create summary message
        let message = `Multi-environment execution completed!\n\n`;
        message += `Status: ${result.status.toUpperCase()}\n`;
        message += `Successful: ${summary.successfulExecutions}/${summary.totalEnvironments}\n`;
        message += `Duration: ${summary.totalDuration}ms\n\n`;

        if (summary.failedExecutions > 0) {
            message += `Failed environments:\n`;
            results.filter(r => r.error).forEach(r => {
                message += `- ${r.environmentName}: ${r.error}\n`;
            });
            message += `\n`;
        }

        message += `Comparison notebooks created for each environment.`;

        // Show notification with action to open comparison folder
        const action = await vscode.window.showInformationMessage(
            message,
            'Open Comparison Folder',
            'View Summary'
        );

        if (action === 'Open Comparison Folder') {
            // Open the api-comparisons folder
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
            if (workspaceRoot) {
                const comparisonsDir = vscode.Uri.joinPath(workspaceRoot, 'api-comparisons');
                vscode.commands.executeCommand('revealFileInOS', comparisonsDir);
            }
        } else if (action === 'View Summary') {
            // Create and show a summary notebook
            await this.createSummaryNotebook(result);
        }
    }

    /**
     * Create a summary notebook showing all execution results
     */
    private async createSummaryNotebook(result: GroupExecutionResult): Promise<void> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const summaryFilename = `api-comparison-summary-${timestamp}.pfhttp`;
        
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!workspaceRoot) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        const comparisonsDir = vscode.Uri.joinPath(workspaceRoot, 'api-comparisons');
        const summaryUri = vscode.Uri.joinPath(comparisonsDir, summaryFilename);

        // Generate summary content
        let content = `# Multi-Environment Execution Summary\n\n`;
        content += `**Execution ID:** ${result.request.executionId}\n`;
        content += `**Request:** ${result.request.template.method} ${result.request.template.path}\n`;
        content += `**Executed:** ${new Date().toISOString()}\n`;
        content += `**Status:** ${result.status.toUpperCase()}\n\n`;

        content += `## Summary\n\n`;
        content += `- **Total Environments:** ${result.summary.totalEnvironments}\n`;
        content += `- **Successful:** ${result.summary.successfulExecutions}\n`;
        content += `- **Failed:** ${result.summary.failedExecutions}\n`;
        content += `- **Total Duration:** ${result.summary.totalDuration}ms\n\n`;

        content += `## Results by Environment\n\n`;
        result.results.forEach(envResult => {
            content += `### ${envResult.environmentName}\n\n`;
            if (envResult.error) {
                content += `❌ **Failed:** ${envResult.error}\n\n`;
            } else {
                const duration = typeof envResult.result.timing === 'object' ? 
                    envResult.result.timing.duration : envResult.result.timing;
                content += `✅ **Success:** ${envResult.result.status} ${envResult.result.statusText}\n`;
                content += `⏱️ **Duration:** ${duration}ms\n`;
                content += `📄 **Notebook:** [${envResult.notebookUri.fsPath.split('/').pop()}](${envResult.notebookUri.toString()})\n\n`;
            }
        });

        // Create the summary file
        await vscode.workspace.fs.writeFile(summaryUri, Buffer.from(content, 'utf8'));
        
        // Open the summary notebook
        await vscode.window.showTextDocument(summaryUri);
    }    /**
     * Get the group executor for multi-environment execution
     */
    getGroupExecutor(): GroupExecutor {
        return this.groupExecutor;
    }

    /**
     * Get the notebook request history provider
     */
    getRequestHistoryProvider(): NotebookRequestHistoryProvider {
        return this.requestHistory;
    }

    /**
     * Confirms DELETE request execution with the user
     */
    private async confirmDeleteRequest(request: any): Promise<boolean> {
        const url = request.url;
        const method = request.method.toUpperCase();
        
        const result = await vscode.window.showWarningMessage(
            `You are about to execute a ${method} request to:\n${url}\n\nThis may permanently delete data and cannot be undone.`,
            { modal: true },
            'Execute DELETE Request',
            'Cancel'
        );
        
        return result === 'Execute DELETE Request';
    }
}
