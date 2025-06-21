/**
 * EnvironmentSelectorWebview - WebView for selecting target environments for multi-environment execution
 * 
 * This webview allows users to select which environments from a group they want to
 * execute their request against for comparison purposes.
 */

import * as vscode from 'vscode';
import { ConfigurationManager } from '../configuration';
import { SchemaEnvironment } from '../types';
import { RequestTemplate } from '../notebook/group-executor';

/**
 * Result of environment selection
 */
export interface EnvironmentSelectionResult {
    /** Selected environment IDs */
    selectedEnvironmentIds: string[];
    
    /** The request template to execute */
    template: RequestTemplate;
    
    /** Whether the user confirmed the selection */
    confirmed: boolean;
}

/**
 * Webview for selecting target environments for multi-environment execution
 */
export class EnvironmentSelectorWebview {
    private panel: vscode.WebviewPanel | undefined;
    private readonly configManager: ConfigurationManager;

    constructor(
        private readonly context: vscode.ExtensionContext,
        configManager: ConfigurationManager
    ) {
        this.configManager = configManager;
    }

    /**
     * Show the environment selector webview
     */    async show(template: RequestTemplate): Promise<EnvironmentSelectionResult | undefined> {
        return new Promise((resolve) => {
            this.panel = vscode.window.createWebviewPanel(
                'pathfinder.environmentSelector',
                'Select Target Environments',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                }
            );

            // Handle disposal
            this.panel.onDidDispose(() => {
                this.panel = undefined;
                resolve(undefined);
            });

            // Handle messages from webview
            this.panel.webview.onDidReceiveMessage(async (message) => {
                switch (message.command) {
                    case 'selectEnvironments':
                        resolve({
                            selectedEnvironmentIds: message.environmentIds,
                            template,
                            confirmed: true
                        });
                        this.panel?.dispose();
                        break;
                        
                    case 'cancel':
                        resolve(undefined);
                        this.panel?.dispose();
                        break;
                }
            });            // Set the webview content
            this.getWebviewContent(template).then(html => {
                if (this.panel) {
                    this.panel.webview.html = html;
                }
            });
        });
    }

    /**
     * Generate the HTML content for the webview
     */    private async getWebviewContent(template: RequestTemplate): Promise<string> {
        // Get environments for the schema
        const environments = await this.configManager.getSchemaEnvironments(template.schemaId);
        
        // Find the source environment to exclude it or highlight it
        const sourceEnvironment = environments.find(env => env.id === template.sourceEnvironmentId);
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Select Target Environments</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
        }
        
        .header {
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .request-info {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
        
        .request-info h3 {
            margin: 0 0 10px 0;
            color: var(--vscode-textCodeBlock-background);
        }
        
        .request-details {
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            opacity: 0.8;
        }
        
        .environment-section {
            margin-bottom: 25px;
        }
        
        .environment-section h3 {
            margin: 0 0 15px 0;
            color: var(--vscode-textPreformat-foreground);
        }
        
        .environment-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .environment-item {
            display: flex;
            align-items: center;
            padding: 12px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            background-color: var(--vscode-input-background);
        }
        
        .environment-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .environment-item.source {
            background-color: var(--vscode-inputValidation-infoBackground);
            border-color: var(--vscode-inputValidation-infoBorder);
        }
        
        .environment-checkbox {
            margin-right: 12px;
        }
        
        .environment-info {
            flex: 1;
        }
        
        .environment-name {
            font-weight: 500;
            margin-bottom: 4px;
        }
        
        .environment-url {
            font-size: 11px;
            opacity: 0.7;
            font-family: var(--vscode-editor-font-family);
        }
        
        .source-badge {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 500;
            margin-left: 8px;
        }
        
        .group-section {
            margin-bottom: 15px;
            padding: 10px;
            background-color: var(--vscode-editor-background);
            border-radius: 4px;
            border: 1px solid var(--vscode-panel-border);
        }
        
        .group-title {
            font-weight: 500;
            margin-bottom: 8px;
            font-size: 13px;
        }
        
        .actions {
            margin-top: 30px;
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 2px;
            cursor: pointer;
            font-size: var(--vscode-font-size);
        }
        
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .selection-info {
            margin-top: 15px;
            padding: 10px;
            background-color: var(--vscode-inputValidation-infoBackground);
            border-radius: 4px;
            font-size: 12px;
        }
        
        .no-environments {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Select Target Environments</h2>
            <p>Choose which environments you want to execute this request against for comparison.</p>
        </div>
        
        <div class="request-info">
            <h3>Request to Execute</h3>
            <div class="request-details">
                <strong>${template.method}</strong> ${template.path}<br>
                <small>Originally executed against: ${sourceEnvironment?.name ?? 'Unknown Environment'}</small>
            </div>
        </div>
          <div class="environment-section">
            <h3>Available Environments</h3>
            ${this.generateEnvironmentList(environments, template.sourceEnvironmentId)}
        </div>
        
        <div class="selection-info" id="selectionInfo" style="display: none;">
            <span id="selectionCount">0</span> environment(s) selected
        </div>
        
        <div class="actions">
            <button class="secondary" onclick="cancel()">Cancel</button>
            <button id="executeButton" onclick="executeSelection()" disabled>Execute Against Selected</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function updateSelection() {
            const checkboxes = document.querySelectorAll('.environment-checkbox:checked');
            const count = checkboxes.length;
            const executeButton = document.getElementById('executeButton');
            const selectionInfo = document.getElementById('selectionInfo');
            const selectionCount = document.getElementById('selectionCount');
            
            selectionCount.textContent = count;
            executeButton.disabled = count === 0;
            selectionInfo.style.display = count > 0 ? 'block' : 'none';
        }
        
        function executeSelection() {
            const checkboxes = document.querySelectorAll('.environment-checkbox:checked');
            const environmentIds = Array.from(checkboxes).map(cb => cb.value);
            
            vscode.postMessage({
                command: 'selectEnvironments',
                environmentIds: environmentIds
            });
        }
        
        function cancel() {
            vscode.postMessage({
                command: 'cancel'
            });
        }
        
        // Add event listeners to all checkboxes
        document.addEventListener('change', function(e) {
            if (e.target.classList.contains('environment-checkbox')) {
                updateSelection();
            }
        });
        
        // Initial update
        updateSelection();
    </script>
</body>
</html>`;
    }    /**
     * Generate HTML for a list of environments
     */
    private generateEnvironmentList(environments: SchemaEnvironment[], sourceEnvironmentId: string): string {
        if (environments.length === 0) {
            return '<div class="no-environments">No environments available for this schema.</div>';
        }

        return environments.map(env => {
            const isSource = env.id === sourceEnvironmentId;
            const sourceClass = isSource ? ' source' : '';
            const sourceBadge = isSource ? '<span class="source-badge">SOURCE</span>' : '';
            
            return `
                <div class="environment-item${sourceClass}">
                    <input type="checkbox" class="environment-checkbox" value="${env.id}" ${isSource ? 'disabled' : ''}>
                    <div class="environment-info">
                        <div class="environment-name">${env.name}${sourceBadge}</div>
                        <div class="environment-url">${env.baseUrl}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
}
