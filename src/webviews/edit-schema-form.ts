/**
 * Webview form for editing an existing API schema
 * This replaces the multiple input dialogs with a single comprehensive form
 */

import * as vscode from 'vscode';
import { ConfigurationManager } from '../configuration';
import { ApiSchema } from '../types';

export class EditSchemaWebview {
    private panel: vscode.WebviewPanel | undefined;
    
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly configManager: ConfigurationManager,
        private readonly schema: ApiSchema,
        private readonly onSchemaUpdated: () => void
    ) {}

    public async show() {
        // Create and show webview panel
        this.panel = vscode.window.createWebviewPanel(
            'editSchemaForm',
            `Edit Schema: ${this.schema.name}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'media'),
                    vscode.Uri.joinPath(this.context.extensionUri, 'webviews')
                ]
            }
        );

        // Set up message handling
        this.panel.webview.onDidReceiveMessage(
            message => this.handleMessage(message),
            undefined,
            this.context.subscriptions
        );

        // Set the HTML content
        this.panel.webview.html = this.getWebviewContent();
    }

    private async handleMessage(message: any) {
        switch (message.command) {
            case 'submitForm':
                await this.handleFormSubmission(message.data);
                break;
            case 'cancel':
                this.panel?.dispose();
                break;
        }
    }

    private async handleFormSubmission(data: any) {
        try {
            // Show loading state
            await this.panel?.webview.postMessage({
                command: 'setLoading',
                loading: true,
                message: 'Updating schema...'
            });

            // Validate form data
            if (!data.name?.trim()) {
                throw new Error('Schema name is required');
            }

            // Update the schema
            const updatedSchema: ApiSchema = {
                ...this.schema,
                name: data.name.trim(),
                description: data.description?.trim() || this.schema.description,
                color: data.color || this.schema.color,
                lastUpdated: new Date()
            };

            // Save the updated schema
            await this.configManager.saveApiSchema(updatedSchema);

            // Notify success
            await this.panel?.webview.postMessage({
                command: 'setLoading',
                loading: false
            });

            // Show success message
            vscode.window.showInformationMessage(`Schema "${data.name}" updated successfully!`);

            // Close the webview and refresh
            this.panel?.dispose();
            this.onSchemaUpdated();

        } catch (error) {
            // Show error state
            await this.panel?.webview.postMessage({
                command: 'setLoading',
                loading: false
            });

            await this.panel?.webview.postMessage({
                command: 'showError',
                error: `Failed to update schema: ${error}`
            });
        }
    }

    private getWebviewContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Edit Schema</title>
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
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            color: var(--vscode-input-foreground);
        }
        
        input, textarea {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 3px;
            font-family: inherit;
            font-size: inherit;
            box-sizing: border-box;
        }
        
        input:focus, textarea:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        textarea {
            min-height: 80px;
            resize: vertical;
        }
        
        .color-group {
            display: flex;
            gap: 12px;
            margin-top: 8px;
            flex-wrap: wrap;
        }
        
        .color-option {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            border: 3px solid var(--vscode-widget-border);
            cursor: pointer;
            transition: all 0.2s ease-in-out;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .color-option:hover {
            transform: scale(1.1);
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        
        .color-option.selected {
            border-color: var(--vscode-focusBorder);
            border-width: 4px;
            box-shadow: 0 0 0 2px var(--vscode-focusBorder), 0 4px 12px rgba(0, 0, 0, 0.3);
            transform: scale(1.05);
        }
        
        .color-option.selected::after {
            content: '✓';
            color: white;
            font-weight: bold;
            font-size: 18px;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 1;
        }
        
        .color-option:focus {
            outline: 2px solid var(--vscode-focusBorder);
            outline-offset: 2px;
        }
        
        .color-blue { background-color: #007ACC; }
        .color-green { background-color: #28A745; }
        .color-orange { background-color: #FD7E14; }
        .color-purple { background-color: #6F42C1; }
        .color-red { background-color: #DC3545; }
        .color-yellow { background-color: #FFC107; }
        
        .buttons {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-widget-border);
        }
        
        .button {
            padding: 10px 20px;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-family: inherit;
            font-size: inherit;
            min-width: 80px;
        }
        
        .button-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .button-primary:hover:not(:disabled) {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .button-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .button-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .loading {
            display: none;
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
        }
        
        .loading.show {
            display: block;
        }
        
        .error {
            display: none;
            padding: 10px;
            margin: 10px 0;
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 3px;
            color: var(--vscode-inputValidation-errorForeground);
        }
        
        .error.show {
            display: block;
        }
        
        .hint {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }
        
        h1 {
            margin: 0 0 30px 0;
            color: var(--vscode-titleBar-activeForeground);
        }
        
        .schema-info {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            padding: 12px;
            margin-bottom: 20px;
            border-radius: 0 3px 3px 0;
        }
        
        .schema-info h3 {
            margin: 0 0 8px 0;
            color: var(--vscode-titleBar-activeForeground);
        }
        
        .schema-info p {
            margin: 4px 0;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Edit Schema</h1>
        
        <div class="schema-info">
            <h3>Current Schema Information</h3>
            <p><strong>Source:</strong> ${this.schema.source}</p>
            <p><strong>Version:</strong> ${this.schema.version}</p>
            <p><strong>Last Updated:</strong> ${this.schema.lastUpdated?.toLocaleString() || 'Unknown'}</p>
        </div>
        
        <div class="error" id="errorMessage"></div>
        
        <form id="schemaForm">
            <div class="form-group">
                <label for="name">Schema Name *</label>
                <input type="text" id="name" name="name" value="${this.schema.name}" required>
                <div class="hint">A descriptive name for this API schema</div>
            </div>
            
            <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" placeholder="e.g., Kibana management API for production environment">${this.schema.description || ''}</textarea>
                <div class="hint">Optional description that will be shown in the tree view</div>
            </div>
            
            <div class="form-group">
                <label>Color Theme</label>
                <div class="color-group">
                    <div class="color-option color-blue ${this.schema.color === 'blue' ? 'selected' : ''}" data-color="blue" title="Blue" role="button" aria-label="Select blue color theme" tabindex="0"></div>
                    <div class="color-option color-green ${this.schema.color === 'green' ? 'selected' : ''}" data-color="green" title="Green" role="button" aria-label="Select green color theme" tabindex="0"></div>
                    <div class="color-option color-orange ${this.schema.color === 'orange' ? 'selected' : ''}" data-color="orange" title="Orange" role="button" aria-label="Select orange color theme" tabindex="0"></div>
                    <div class="color-option color-purple ${this.schema.color === 'purple' ? 'selected' : ''}" data-color="purple" title="Purple" role="button" aria-label="Select purple color theme" tabindex="0"></div>
                    <div class="color-option color-red ${this.schema.color === 'red' ? 'selected' : ''}" data-color="red" title="Red" role="button" aria-label="Select red color theme" tabindex="0"></div>
                    <div class="color-option color-yellow ${this.schema.color === 'yellow' ? 'selected' : ''}" data-color="yellow" title="Yellow" role="button" aria-label="Select yellow color theme" tabindex="0"></div>
                </div>
                <div class="hint">Choose a color for visual identification in the tree view</div>
            </div>
        </form>
        
        <div class="loading" id="loadingMessage">
            <div>⏳ Updating schema...</div>
        </div>
        
        <div class="buttons">
            <button type="button" class="button button-secondary" id="cancelButton">Cancel</button>
            <button type="submit" class="button button-primary" id="submitButton" form="schemaForm">Update Schema</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        // Form elements
        const form = document.getElementById('schemaForm');
        const nameInput = document.getElementById('name');
        const descriptionInput = document.getElementById('description');
        const errorMessage = document.getElementById('errorMessage');
        const loadingMessage = document.getElementById('loadingMessage');
        const submitButton = document.getElementById('submitButton');
        const cancelButton = document.getElementById('cancelButton');
        
        // State
        let selectedColor = '${this.schema.color || 'blue'}';
        
        // Color selection
        document.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', () => {
                selectColor(option);
            });
            
            // Keyboard support
            option.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectColor(option);
                }
            });
        });
        
        function selectColor(selectedOption) {
            document.querySelectorAll('.color-option').forEach(o => {
                o.classList.remove('selected');
                o.setAttribute('aria-pressed', 'false');
            });
            selectedOption.classList.add('selected');
            selectedOption.setAttribute('aria-pressed', 'true');
            selectedColor = selectedOption.dataset.color;
        }
        
        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const formData = {
                name: nameInput.value.trim(),
                description: descriptionInput.value.trim(),
                color: selectedColor
            };
            
            // Basic validation
            if (!formData.name) {
                showError('Schema name is required');
                return;
            }
            
            vscode.postMessage({
                command: 'submitForm',
                data: formData
            });
        });
        
        // Cancel button
        cancelButton.addEventListener('click', () => {
            vscode.postMessage({ command: 'cancel' });
        });
        
        // Message handling
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'setLoading':
                    setLoading(message.loading, message.message);
                    break;
                case 'showError':
                    showError(message.error);
                    break;
            }
        });
        
        function setLoading(loading, message = 'Loading...') {
            if (loading) {
                loadingMessage.querySelector('div').textContent = message;
                loadingMessage.classList.add('show');
                submitButton.disabled = true;
                cancelButton.disabled = true;
            } else {
                loadingMessage.classList.remove('show');
                submitButton.disabled = false;
                cancelButton.disabled = false;
            }
        }
        
        function showError(error) {
            errorMessage.textContent = error;
            errorMessage.classList.add('show');
            setTimeout(() => {
                errorMessage.classList.remove('show');
            }, 5000);
        }
        
        // Focus first input
        nameInput.focus();
        nameInput.select();
    </script>
</body>
</html>`;
    }
}
