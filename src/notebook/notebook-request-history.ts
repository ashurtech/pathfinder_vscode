/**
 * NotebookRequestHistory - Request history tracking specifically for notebook-based HTTP requests
 * 
 * This class manages request history within the notebook environment, providing:
 * - History tracking for notebook HTTP cell executions
 * - Integration with the notebook controller
 * - Enhanced metadata for notebook context
 * - Support for multi-environment execution tracking
 */

import * as vscode from 'vscode';
import { ParsedHttpRequest, HttpExecutionResult } from './http-request-executor';

/**
 * Represents a single request/response pair in notebook history
 */
export interface NotebookRequestHistoryItem {
    /** Timestamp when the request was executed */
    timestamp: number;
    
    /** The parsed HTTP request that was executed */
    request: ParsedHttpRequest;
    
    /** The execution result from the HTTP request */
    response: HttpExecutionResult;
    
    /** Notebook metadata at time of execution */
    notebookMetadata: {
        /** ID of the schema used */
        schemaId?: string;
        
        /** ID of the environment used */
        environmentId?: string;
        
        /** Name of the notebook file */
        notebookName?: string;
        
        /** URI of the notebook */
        notebookUri?: string;
        
        /** Cell index where the request was executed */
        cellIndex?: number;
    };
    
    /** Execution context information */
    executionContext: {
        /** Variables available at execution time */
        variables: Record<string, any>;
        
        /** Execution duration in milliseconds */
        duration: number;
        
        /** Whether this was part of a multi-environment execution */
        isMultiEnvironment?: boolean;
        
        /** Group of environments if multi-environment execution */
        environmentGroup?: string;
    };
}

/**
 * Provider for notebook request history tree view
 */
export class NotebookRequestHistoryProvider implements vscode.TreeDataProvider<NotebookRequestHistoryItem> {    private readonly _onDidChangeTreeData: vscode.EventEmitter<NotebookRequestHistoryItem | undefined> = 
        new vscode.EventEmitter<NotebookRequestHistoryItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<NotebookRequestHistoryItem | undefined> = 
        this._onDidChangeTreeData.event;

    private history: NotebookRequestHistoryItem[] = [];
    private readonly maxHistoryItems = 100; // More items since notebooks are more interactive

    constructor(private readonly context: vscode.ExtensionContext) {
        this.loadHistoryFromStorage();
    }

    getTreeItem(element: NotebookRequestHistoryItem): vscode.TreeItem {
        const requestUrl = element.request.url || 'Unknown URL';
        const method = element.request.method || 'GET';
        const status = element.response.status || 0;
        const statusText = element.response.statusText || 'Unknown';
        
        const item = new vscode.TreeItem(
            `${method} ${this.truncateUrl(requestUrl)}`,
            vscode.TreeItemCollapsibleState.None
        );
          // Enhanced tooltip with notebook context
        const notebook = element.notebookMetadata.notebookName ?? 'Unknown Notebook';
        const environment = element.notebookMetadata.environmentId ?? 'No Environment';
        const duration = element.executionContext.duration;
        
        item.tooltip = `Notebook: ${notebook}\n` +
                      `Environment: ${environment}\n` +
                      `Status: ${status} - ${statusText}\n` +
                      `Duration: ${duration}ms\n` +
                      `Time: ${new Date(element.timestamp).toLocaleString()}`;
        
        // Description shows status and time
        const timeStr = new Date(element.timestamp).toLocaleTimeString();
        item.description = `${status} - ${timeStr}`;
        
        // Icon based on status
        if (status >= 200 && status < 300) {
            item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
        } else if (status >= 400) {
            item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
        } else {
            item.iconPath = new vscode.ThemeIcon('question', new vscode.ThemeColor('testing.iconQueued'));
        }
        
        // Context value for different menu options
        item.contextValue = 'notebookRequestHistoryItem';
        
        // Command to recreate request in new notebook
        item.command = {
            command: 'pathfinder.recreateRequestFromHistory',
            title: 'Recreate Request in New Notebook',
            arguments: [element]
        };

        return item;
    }

    getChildren(): NotebookRequestHistoryItem[] {
        return this.history.slice().reverse(); // Show newest first
    }

    /**
     * Add a new request/response to the history
     */
    addToHistory(
        request: ParsedHttpRequest,
        response: HttpExecutionResult,
        notebookDocument?: vscode.NotebookDocument,
        cellIndex?: number,
        variables?: Record<string, any>,
        duration?: number
    ) {
        const notebookMetadata = {
            schemaId: notebookDocument?.metadata?.pathfinder?.schemaId,
            environmentId: notebookDocument?.metadata?.pathfinder?.environmentId,
            notebookName: this.getNotebookName(notebookDocument),
            notebookUri: notebookDocument?.uri.toString(),
            cellIndex
        };

        const item: NotebookRequestHistoryItem = {
            timestamp: Date.now(),
            request,
            response,
            notebookMetadata,            executionContext: {
                variables: variables ?? {},
                duration: duration ?? 0
            }
        };

        this.history.unshift(item);
        
        // Maintain maximum history size
        if (this.history.length > this.maxHistoryItems) {
            this.history = this.history.slice(0, this.maxHistoryItems);
        }

        this.saveHistoryToStorage();
        this._onDidChangeTreeData.fire(undefined);
    }

    /**
     * Clear all history
     */
    clearHistory() {
        this.history = [];
        this.saveHistoryToStorage();
        this._onDidChangeTreeData.fire(undefined);
    }

    /**
     * Get history items for a specific notebook
     */
    getHistoryForNotebook(notebookUri: string): NotebookRequestHistoryItem[] {
        return this.history.filter(item => 
            item.notebookMetadata.notebookUri === notebookUri
        );
    }

    /**
     * Get history items for a specific environment
     */
    getHistoryForEnvironment(environmentId: string): NotebookRequestHistoryItem[] {
        return this.history.filter(item => 
            item.notebookMetadata.environmentId === environmentId
        );
    }

    /**
     * Get all unique environments from history
     */
    getUniqueEnvironments(): string[] {
        const environments = new Set<string>();
        this.history.forEach(item => {
            if (item.notebookMetadata.environmentId) {
                environments.add(item.notebookMetadata.environmentId);
            }
        });
        return Array.from(environments);
    }

    /**
     * Truncate URL for display
     */
    private truncateUrl(url: string, maxLength: number = 50): string {
        if (url.length <= maxLength) {
            return url;
        }
        return url.substring(0, maxLength - 3) + '...';
    }

    /**
     * Get a readable name for the notebook
     */
    private getNotebookName(notebook?: vscode.NotebookDocument): string {
        if (!notebook) {
            return 'Unknown';
        }
        
        const fileName = notebook.uri.path.split('/').pop() ?? 'Unknown';
        return fileName.replace('.pfhttp', '');
    }

    /**
     * Save history to extension storage
     */
    private saveHistoryToStorage() {
        try {
            // Only save essential data to avoid storage bloat
            const serializedHistory = this.history.slice(0, 50).map(item => ({
                timestamp: item.timestamp,
                request: {
                    method: item.request.method,
                    url: item.request.url,
                    headers: item.request.headers
                },                response: {
                    status: item.response.status,
                    statusText: item.response.statusText,
                    duration: typeof item.response.timing === 'object' 
                        ? item.response.timing.duration 
                        : item.response.timing
                },
                notebookMetadata: item.notebookMetadata,
                executionContext: {
                    duration: item.executionContext.duration,
                    isMultiEnvironment: item.executionContext.isMultiEnvironment,
                    environmentGroup: item.executionContext.environmentGroup
                }
            }));
            
            this.context.globalState.update('pathfinder.notebookRequestHistory', serializedHistory);
        } catch (error) {
            console.warn('Failed to save notebook request history:', error);
        }
    }

    /**
     * Load history from extension storage
     */
    private loadHistoryFromStorage() {
        try {
            const saved = this.context.globalState.get<any[]>('pathfinder.notebookRequestHistory', []);
            this.history = saved.map(item => ({
                ...item,
                executionContext: {
                    variables: {},
                    ...item.executionContext
                }
            }));
        } catch (error) {
            console.warn('Failed to load notebook request history:', error);
            this.history = [];
        }
    }
}
