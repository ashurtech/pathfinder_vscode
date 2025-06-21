/**
 * GroupExecutor - Multi-environment request execution for notebooks
 * 
 * This class handles executing the same HTTP request across multiple environments
 * in an environment group, generating individual result notebooks for comparison.
 */

import * as vscode from 'vscode';
import { ConfigurationManager } from '../configuration';
import { SchemaEnvironment } from '../types';
import { HttpRequestExecutor, ParsedHttpRequest, HttpExecutionResult } from './http-request-executor';
import { NotebookController } from './notebook-controller';
import { NotebookRequestHistoryItem } from './notebook-request-history';

/**
 * Template for a request that can be executed across multiple environments
 */
export interface RequestTemplate {
    /** Unique identifier for this request template */
    id: string;
    
    /** HTTP method (GET, POST, etc.) */
    method: string;
    
    /** Relative path without base URL */
    path: string;
    
    /** HTTP headers */
    headers: Record<string, string>;
    
    /** Request body (if applicable) */
    body?: string;
    
    /** Variables used in the request */
    variables?: Record<string, string>;
    
    /** ID of the environment this request was originally executed against */
    sourceEnvironmentId: string;
    
    /** When this template was created */
    executedAt: Date;
    
    /** OpenAPI operation ID (if available) */
    operationId?: string;
    
    /** Schema ID this request belongs to */
    schemaId: string;
    
    /** Original notebook URI */
    sourceNotebookUri: string;
}

/**
 * Request to execute a template across multiple environments
 */
export interface GroupExecutionRequest {
    /** The request template to execute */
    template: RequestTemplate;
    
    /** Target environment IDs to execute against */
    targetEnvironments: string[];
    
    /** URI of the source notebook */
    sourceNotebookUri: string;
    
    /** Unique execution ID */
    executionId: string;
}

/**
 * Result of a group execution
 */
export interface GroupExecutionResult {
    /** The execution request that generated this result */
    request: GroupExecutionRequest;
    
    /** Results per environment */
    results: {
        environmentId: string;
        environmentName: string;
        result: HttpExecutionResult;
        notebookUri: vscode.Uri;
        error?: string;
    }[];
    
    /** Overall execution status */
    status: 'success' | 'partial' | 'failed';
    
    /** Execution summary */
    summary: {
        totalEnvironments: number;
        successfulExecutions: number;
        failedExecutions: number;
        totalDuration: number;
    };
}

/**
 * Handles multi-environment request execution
 */
export class GroupExecutor {
    private readonly httpExecutor: HttpRequestExecutor;
    private readonly configManager: ConfigurationManager;

    constructor(
        private readonly notebookController: NotebookController,
        configManager: ConfigurationManager
    ) {
        this.httpExecutor = new HttpRequestExecutor();
        this.configManager = configManager;
    }

    /**
     * Create a request template from a history item
     */    createRequestTemplate(historyItem: NotebookRequestHistoryItem): RequestTemplate {
        const template: RequestTemplate = {
            id: `template_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            method: historyItem.request.method || 'GET',
            path: this.extractRelativePath(historyItem.request.url || ''),
            headers: historyItem.request.headers || {},
            body: historyItem.request.body,
            variables: historyItem.executionContext.variables,
            sourceEnvironmentId: historyItem.notebookMetadata.environmentId ?? '',
            executedAt: new Date(historyItem.timestamp),
            schemaId: historyItem.notebookMetadata.schemaId ?? '',
            sourceNotebookUri: historyItem.notebookMetadata.notebookUri ?? ''
        };

        return template;
    }

    /**
     * Execute a request template across multiple environments
     */
    async executeAcrossEnvironments(
        template: RequestTemplate,
        targetEnvironmentIds: string[],
        progressCallback?: (progress: { current: number; total: number; environmentName: string }) => void
    ): Promise<GroupExecutionResult> {
        const executionId = `group_exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        
        const groupRequest: GroupExecutionRequest = {
            template,
            targetEnvironments: targetEnvironmentIds,
            sourceNotebookUri: template.sourceNotebookUri,
            executionId
        };

        const results: GroupExecutionResult['results'] = [];
        const startTime = Date.now();

        // Get all environments
        const environments = await this.getEnvironmentsForExecution(targetEnvironmentIds);
        
        for (let i = 0; i < environments.length; i++) {
            const environment = environments[i];
            
            if (progressCallback) {
                progressCallback({
                    current: i + 1,
                    total: environments.length,
                    environmentName: environment.name
                });
            }

            try {
                // Execute request against this environment
                const result = await this.executeRequestForEnvironment(template, environment);
                
                // Create comparison notebook
                const notebookUri = await this.createComparisonNotebook(
                    template,
                    environment,
                    result,
                    executionId
                );

                results.push({
                    environmentId: environment.id,
                    environmentName: environment.name,
                    result,
                    notebookUri
                });

            } catch (error) {
                results.push({
                    environmentId: environment.id,
                    environmentName: environment.name,
                    result: {
                        success: false,
                        status: 0,
                        statusText: 'Execution Failed',
                        data: null,
                        headers: {},
                        timing: 0
                    },
                    notebookUri: vscode.Uri.file(''),
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }        const totalDuration = Date.now() - startTime;
        const successfulExecutions = results.filter(r => !r.error && r.result.success).length;
        const failedExecutions = results.length - successfulExecutions;

        // Determine overall status
        let status: 'success' | 'partial' | 'failed';
        if (failedExecutions === 0) {
            status = 'success';
        } else if (successfulExecutions === 0) {
            status = 'failed';
        } else {
            status = 'partial';
        }

        const groupResult: GroupExecutionResult = {
            request: groupRequest,
            results,
            status,
            summary: {
                totalEnvironments: environments.length,
                successfulExecutions,
                failedExecutions,
                totalDuration
            }
        };

        return groupResult;
    }

    /**
     * Execute a request template against a specific environment
     */
    private async executeRequestForEnvironment(
        template: RequestTemplate,
        environment: SchemaEnvironment
    ): Promise<HttpExecutionResult> {
        // Construct full URL
        const fullUrl = this.buildFullUrl(environment.baseUrl, template.path);
          // Create parsed request for execution
        const parsedRequest: ParsedHttpRequest = {
            method: template.method,
            url: fullUrl,
            headers: {
                ...template.headers,
                ...(environment.customHeaders || {})
            },
            body: template.body
        };

        // Execute the request
        return await this.httpExecutor.executeRequest(parsedRequest);
    }

    /**
     * Create a comparison notebook for the execution result
     */
    private async createComparisonNotebook(
        template: RequestTemplate,
        environment: SchemaEnvironment,
        result: HttpExecutionResult,
        executionId: string
    ): Promise<vscode.Uri> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `api-comparison-${timestamp}-${environment.name.replace(/[^a-zA-Z0-9]/g, '-')}.pfhttp`;
        
        // Create comparisons directory if it doesn't exist
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!workspaceRoot) {
            throw new Error('No workspace folder found');
        }

        const comparisonsDir = vscode.Uri.joinPath(workspaceRoot, 'api-comparisons');
        const notebookUri = vscode.Uri.joinPath(comparisonsDir, filename);

        // Generate notebook content
        const notebookContent = this.generateComparisonNotebookContent(
            template,
            environment,
            result,
            executionId
        );

        // Create the notebook file
        await vscode.workspace.fs.writeFile(
            notebookUri,
            Buffer.from(notebookContent, 'utf8')
        );

        return notebookUri;
    }

    /**
     * Generate content for a comparison notebook
     */
    private generateComparisonNotebookContent(
        template: RequestTemplate,
        environment: SchemaEnvironment,
        result: HttpExecutionResult,
        executionId: string
    ): string {
        const timestamp = new Date().toISOString();
        const fullUrl = this.buildFullUrl(environment.baseUrl, template.path);

        let content = `# API Comparison Result\n\n`;
        content += `**Execution ID:** ${executionId}\n`;
        content += `**Environment:** ${environment.name}\n`;
        content += `**Executed:** ${timestamp}\n`;
        content += `**Original Request:** ${template.method} ${template.path}\n\n`;

        // HTTP Request Cell
        content += `## HTTP Request\n\n`;
        content += `\`\`\`http\n`;
        content += `${template.method} ${fullUrl}\n`;
          // Add headers
        const allHeaders = { ...template.headers, ...(environment.customHeaders || {}) };
        Object.entries(allHeaders).forEach(([key, value]) => {
            content += `${key}: ${value}\n`;
        });

        if (template.body) {
            content += `\n${template.body}`;
        }
        content += `\n\`\`\`\n\n`;

        // Response Section
        content += `## Response\n\n`;
        content += `**Status:** ${result.status} ${result.statusText}\n`;
        content += `**Duration:** ${typeof result.timing === 'object' ? result.timing.duration : result.timing}ms\n\n`;

        // Response Headers
        if (result.headers && Object.keys(result.headers).length > 0) {
            content += `### Response Headers\n\n`;
            Object.entries(result.headers).forEach(([key, value]) => {
                content += `- **${key}:** ${value}\n`;
            });
            content += `\n`;
        }

        // Response Body
        if (result.data) {
            content += `### Response Body\n\n`;
            content += `\`\`\`json\n`;
            content += typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);
            content += `\n\`\`\`\n`;
        }

        return content;
    }

    /**
     * Get environments for execution
     */    private async getEnvironmentsForExecution(environmentIds: string[]): Promise<SchemaEnvironment[]> {
        const allEnvironments = await this.configManager.getSchemaEnvironments();
        return allEnvironments.filter(env => environmentIds.includes(env.id));
    }

    /**
     * Extract relative path from full URL
     */
    private extractRelativePath(fullUrl: string): string {
        try {
            const url = new URL(fullUrl);
            return url.pathname + url.search;
        } catch {
            // If URL parsing fails, return as-is
            return fullUrl;
        }
    }

    /**
     * Build full URL from base URL and relative path
     */
    private buildFullUrl(baseUrl: string, relativePath: string): string {
        const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const path = relativePath.startsWith('/') ? relativePath : '/' + relativePath;
        return base + path;
    }
}
