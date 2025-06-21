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
    private variableContext: VariableContext = {};

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly configManager: ConfigurationManager
    ) {
        // Create the notebook controller for HTTP requests
        this.controller = vscode.notebooks.createNotebookController(
            'pathfinder-http-notebook',
            'pathfinder-http-notebook',
            'Pathfinder HTTP Request Notebook'
        );

        this.controller.supportedLanguages = ['http', 'markdown', 'json'];
        this.controller.supportsExecutionOrder = true;
        this.controller.executeHandler = this.executeCell.bind(this);

        // Initialize HTTP execution components
        this.httpExecutor = new HttpRequestExecutor(configManager);
        this.httpParser = new HttpRequestParser();

        // Register the controller
        this.context.subscriptions.push(this.controller);
    }

    /**
     * Creates a new notebook document from an API endpoint
     */
    async createNotebookFromEndpoint(
        endpoint: EndpointInfo,
        schemaId: string,
        environmentId?: string
    ): Promise<vscode.NotebookDocument> {
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
    }    /**
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
    }

    /**
     * Executes a single notebook cell
     */
    private async executeCell(
        cells: vscode.NotebookCell[],
        notebook: vscode.NotebookDocument,
        controller: vscode.NotebookController
    ): Promise<void> {
        for (const cell of cells) {
            await this.executeSingleCell(cell, notebook);
        }
    }

    /**
     * Executes a single cell based on its language
     */
    private async executeSingleCell(
        cell: vscode.NotebookCell,
        notebook: vscode.NotebookDocument
    ): Promise<void> {
        const execution = this.controller.createNotebookCellExecution(cell);
        execution.start(Date.now());

        try {
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
                    throw new Error(`Unsupported language: ${cell.document.languageId}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            execution.replaceOutput(new vscode.NotebookCellOutput([
                vscode.NotebookCellOutputItem.error(new Error(errorMessage))
            ]));
            execution.end(false, Date.now());
        }
    }    /**
     * Executes an HTTP cell
     */
    private async executeHttpCell(
        cell: vscode.NotebookCell,
        execution: vscode.NotebookCellExecution
    ): Promise<void> {
        const httpContent = cell.document.getText();
        const parsedRequest = this.httpParser.parseHttpRequest(httpContent, this.variableContext);
        
        const result = await this.httpExecutor.executeRequest(parsedRequest);
        
        // Update variable context with response data
        if (result.data && typeof result.data === 'object') {
            this.variableContext = { ...this.variableContext, ...result.data };
        }

        // Create detailed outputs showing both request and response
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
            ]),
            // JSON response data (for easy variable extraction)
            new vscode.NotebookCellOutput([
                vscode.NotebookCellOutputItem.json(result, 'application/json')
            ])
        ];

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
        const cells: vscode.NotebookCellData[] = [];

        // Add title cell with endpoint description
        const title = endpoint.summary ?? `${endpoint.method.toUpperCase()} ${endpoint.path}`;
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
        }

        // Add variables cell
        cells.push(new vscode.NotebookCellData(
            vscode.NotebookCellKind.Code,
            '{\n  "baseUrl": "{{baseUrl}}",\n  "apiKey": "{{apiKey}}"\n}',
            'json'
        ));        // Add HTTP request cell
        const httpRequest = this.generateHttpRequest(endpoint, environmentId);
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
    private generateHttpRequest(endpoint: EndpointInfo, environmentId?: string): string {
        let request = `${endpoint.method.toUpperCase()} {{baseUrl}}${endpoint.path}\n`;
        
        // Add common headers
        request += 'Content-Type: application/json\n';
        
        // Add authentication header if needed
        if (environmentId) {
            request += 'Authorization: Bearer {{apiKey}}\n';
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
     * Formats response details for display
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
            try {
                const formatted = JSON.stringify(JSON.parse(result.body), null, 2);
                details += formatted;
            } catch {
                details += result.body;
            }
        }
        
        return details;
    }
}
