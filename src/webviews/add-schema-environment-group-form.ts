import * as vscode from 'vscode';
import { ConfigurationManager } from '../configuration';

export class AddSchemaEnvironmentGroupWebview {
    private panel: vscode.WebviewPanel | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly configManager: ConfigurationManager,
        private readonly schema: any,
        private readonly onGroupAdded: () => void
    ) {}

    async show() {
        // Create and show a new webview panel
        this.panel = vscode.window.createWebviewPanel(
            'addSchemaEnvironmentGroup',
            `Add Environment Group to ${this.schema.name}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Set the webview's initial html content
        this.panel.webview.html = this.getWebviewContent();

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'submitForm':
                        await this.handleFormSubmission(message.data);
                        break;
                    case 'cancel':
                        this.panel?.dispose();
                        break;
                }
            }
        );
    }

    private async handleFormSubmission(data: any) {
        try {
            // Show loading state
            await this.panel?.webview.postMessage({
                command: 'setLoading',
                loading: true,
                message: 'Creating environment group...'
            });

            // Validate required fields
            if (!data.name?.trim()) {
                throw new Error('Group name is required');
            }

            // Create new environment group
            const newGroup = {
                id: `envgroup_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                schemaId: this.schema.id,
                name: data.name.trim(),
                description: data.description?.trim() || '',
                color: (data.color as 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'yellow') ?? 'blue',
                createdAt: new Date()
            };

            // Save the environment group
            await this.configManager.saveSchemaEnvironmentGroup(newGroup);

            // Show success
            await this.panel?.webview.postMessage({
                command: 'setLoading',
                loading: false
            });

            await this.panel?.webview.postMessage({
                command: 'showSuccess',
                message: `Environment group "${newGroup.name}" created successfully!`
            });

            // Close webview after short delay
            setTimeout(() => {
                this.panel?.dispose();
                this.onGroupAdded();
            }, 1500);

        } catch (error) {
            console.error('Error creating environment group:', error);
            
            // Show error
            await this.panel?.webview.postMessage({
                command: 'setLoading',
                loading: false
            });

            await this.panel?.webview.postMessage({
                command: 'showError',
                message: error instanceof Error ? error.message : 'Failed to create environment group'
            });
        }
    }

    private getWebviewContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Add Environment Group to ${this.schema.name}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
            line-height: 1.5;
        }
        
        .header {
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .schema-info {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
            border-left: 4px solid var(--vscode-textLink-foreground);
        }
        
        .form-container {
            max-width: 600px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: var(--vscode-input-foreground);
        }
        
        .required {
            color: var(--vscode-errorForeground);
        }
        
        .form-group input,
        .form-group select,
        .form-group textarea {
            width: 100%;
            padding: 12px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-family: inherit;
            font-size: inherit;
            box-sizing: border-box;
        }
        
        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 1px var(--vscode-focusBorder);
        }
        
        .form-group textarea {
            resize: vertical;
            min-height: 80px;
        }
        
        .color-preview {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 10px;
        }
        
        .color-circle {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 2px solid var(--vscode-panel-border);
        }
        
        .color-blue { background-color: #007acc; }
        .color-green { background-color: #89d185; }
        .color-orange { background-color: #d19a66; }
        .color-purple { background-color: #c678dd; }
        .color-red { background-color: #e06c75; }
        .color-yellow { background-color: #e5c07b; }
        
        .button-container {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        
        button {
            padding: 12px 24px;
            border: none;
            border-radius: 4px;
            font-family: inherit;
            font-size: inherit;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .btn-primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .btn-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .loading {
            display: none;
            text-align: center;
            padding: 20px;
            color: var(--vscode-textPreformat-foreground);
        }
        
        .loading.show {
            display: block;
        }
        
        .error {
            color: var(--vscode-errorForeground);
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 12px;
            border-radius: 4px;
            margin-top: 10px;
            display: none;
        }
        
        .error.show {
            display: block;
        }
        
        .success {
            color: var(--vscode-terminal-ansiGreen);
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-terminal-ansiGreen);
            padding: 12px;
            border-radius: 4px;
            margin-top: 10px;
            display: none;
        }
        
        .success.show {
            display: block;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>Add Environment Group to Schema</h2>
        <div class="schema-info">
            <strong>Schema:</strong> ${this.schema.name}<br>
            <strong>Version:</strong> v${this.schema.version}<br>
            ${this.schema.description ? `<strong>Description:</strong> ${this.schema.description}<br>` : ''}
            <strong>Source:</strong> ${this.schema.source}
        </div>
    </div>
    
    <div class="form-container">
        <form id="environmentGroupForm">
            <div class="form-group">
                <label for="name">Group Name <span class="required">*</span></label>
                <input type="text" id="name" name="name" placeholder="e.g., Development Environments, Production Environments" required>
            </div>
            
            <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" placeholder="Brief description of this environment group (optional)"></textarea>
            </div>
            
            <div class="form-group">
                <label for="color">Color Theme</label>
                <select id="color" name="color">
                    <option value="blue">🔵 Blue</option>
                    <option value="green">🟢 Green</option>
                    <option value="orange">🟠 Orange</option>
                    <option value="purple">🟣 Purple</option>
                    <option value="red">🔴 Red</option>
                    <option value="yellow">🟡 Yellow</option>
                </select>
                <div class="color-preview">
                    <span>Preview:</span>
                    <div class="color-circle color-blue" id="colorPreview"></div>
                </div>
            </div>
            
            <div class="loading" id="loading">
                <div>🔄 Creating environment group...</div>
            </div>
            
            <div class="error" id="error"></div>
            <div class="success" id="success"></div>
            
            <div class="button-container">
                <button type="button" class="btn-secondary" onclick="cancelForm()">Cancel</button>
                <button type="submit" class="btn-primary" id="submitBtn">Create Environment Group</button>
            </div>
        </form>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // Handle form submission
        document.getElementById('environmentGroupForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            
            vscode.postMessage({
                command: 'submitForm',
                data: data
            });
        });

        // Handle color change
        document.getElementById('color').addEventListener('change', function(e) {
            const color = e.target.value;
            const preview = document.getElementById('colorPreview');
            preview.className = 'color-circle color-' + color;
        });

        // Handle messages from extension
        window.addEventListener('message', function(event) {
            const message = event.data;
            
            switch (message.command) {
                case 'setLoading':
                    const loading = document.getElementById('loading');
                    const submitBtn = document.getElementById('submitBtn');
                    
                    if (message.loading) {
                        loading.className = 'loading show';
                        submitBtn.disabled = true;
                        if (message.message) {
                            loading.innerHTML = '<div>🔄 ' + message.message + '</div>';
                        }
                    } else {
                        loading.className = 'loading';
                        submitBtn.disabled = false;
                    }
                    break;
                    
                case 'showError':
                    const error = document.getElementById('error');
                    const success = document.getElementById('success');
                    
                    success.className = 'success';
                    error.className = 'error show';
                    error.textContent = message.message;
                    break;
                    
                case 'showSuccess':
                    const successEl = document.getElementById('success');
                    const errorEl = document.getElementById('error');
                    
                    errorEl.className = 'error';
                    successEl.className = 'success show';
                    successEl.textContent = message.message;
                    break;
            }
        });

        function cancelForm() {
            vscode.postMessage({
                command: 'cancel'
            });
        }
    </script>
</body>
</html>`;
    }
}
