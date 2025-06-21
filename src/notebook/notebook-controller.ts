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
import { HttpRequestExecutor } from './http-request-executor';
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
    }

    /**
     * Alias for createNotebookFromEndpoint to match test expectations
     */
    async createNotebookForEndpoint(
        endpoint: EndpointInfo,
        environment: SchemaEnvironment
    ): Promise<vscode.NotebookDocument> {
        return this.createNotebookFromEndpoint(endpoint, 'default', environment.id);
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
    }

    /**
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

        // Create output with response data
        const outputs = [
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
     */
    private async generateCellsForEndpoint(
        endpoint: EndpointInfo,
        schemaId: string,
        environmentId?: string
    ): Promise<vscode.NotebookCellData[]> {
        const cells: vscode.NotebookCellData[] = [];

        // Add title cell
        cells.push(new vscode.NotebookCellData(
            vscode.NotebookCellKind.Markup,
            `# ${endpoint.method.toUpperCase()} ${endpoint.path}\n\n${endpoint.description ?? 'No description available'}`,
            'markdown'
        ));

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
        ));

        // Add HTTP request cell
        const httpRequest = this.generateHttpRequest(endpoint, environmentId);
        cells.push(new vscode.NotebookCellData(
            vscode.NotebookCellKind.Code,
            httpRequest,
            'http'
        ));

        return cells;
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
    }

    /**
     * Executes multiple cells as expected by tests
     */
    async executeCells(
        cells: vscode.NotebookCell[],
        execution: vscode.NotebookCellExecution,
        context?: VariableContext
    ): Promise<void> {
        if (context) {
            this.variableContext = { ...this.variableContext, ...context };
        }

        for (const cell of cells) {
            await this.executeSingleCell(cell, cell.notebook);
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
}
