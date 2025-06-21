import * as vscode from 'vscode';
import { ConfigurationManager } from '../configuration';

export class EditEnvironmentGroupWebview {
    private panel: vscode.WebviewPanel | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly configManager: ConfigurationManager,
        private readonly group: any,
        private readonly onGroupUpdated: () => void
    ) {}

    async show() {
        // Create and show a new webview panel
        this.panel = vscode.window.createWebviewPanel(
            'editEnvironmentGroup',
            `Edit Environment Group: ${this.group.name}`,
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
            }        );
    }

    private async handleFormSubmission(data: any) {
        try {
            // Show loading state
            await this.panel?.webview.postMessage({
                command: 'setLoading',
                loading: true,
                message: 'Updating environment group...'
            });

            // Validate required fields
            if (!data.name?.trim()) {
                throw new Error('Group name is required');
            }

            // Create updated environment group
            const updatedGroup = {
                ...this.group,
                name: data.name.trim(),
                description: data.description?.trim() ?? '',
                color: (data.color as 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'yellow') ?? this.group.color ?? 'blue',
                defaultAuth: { type: 'none' as const },
                authSecretKey: undefined
            };

            await this.processAuthenticationConfig(data, updatedGroup);

            // Save the environment group (schema-level environment groups only)
            await this.configManager.saveSchemaEnvironmentGroup(updatedGroup);

            await this.showSuccessAndClose(updatedGroup.name);

        } catch (error) {
            console.error('Error updating environment group:', error);
            
            await this.showError(error instanceof Error ? error.message : 'Failed to update environment group');
        }
    }

    private async processAuthenticationConfig(data: any, updatedGroup: any) {
        if (data.authType && data.authType !== 'none') {
            switch (data.authType) {
                case 'apikey':
                    if (!data.apiKey?.trim()) {
                        throw new Error('API Key is required for API Key authentication');
                    }
                    updatedGroup.defaultAuth = {
                        type: 'apikey',
                        apiKeyLocation: data.apiKeyLocation ?? 'header',
                        apiKeyName: data.apiKeyName?.trim() ?? 'X-API-Key'
                    };
                    updatedGroup.authSecretKey = await this.configManager.setCredentials(updatedGroup, { apiKey: data.apiKey.trim() });
                    break;
                case 'bearer':
                    if (!data.bearerToken?.trim()) {
                        throw new Error('Bearer token is required for Bearer Token authentication');
                    }
                    updatedGroup.defaultAuth = { type: 'bearer' };
                    updatedGroup.authSecretKey = await this.configManager.setCredentials(updatedGroup, { apiKey: data.bearerToken.trim() });
                    break;
                case 'basic':
                    if (!data.username?.trim() || !data.password?.trim()) {
                        throw new Error('Username and password are required for Basic Authentication');
                    }
                    updatedGroup.defaultAuth = { type: 'basic', username: data.username.trim() };
                    updatedGroup.authSecretKey = await this.configManager.setCredentials(updatedGroup, { username: data.username.trim(), password: data.password.trim() });
                    break;
            }
        }
    }

    private async showSuccessAndClose(groupName: string) {
        // Show success
        await this.panel?.webview.postMessage({
            command: 'setLoading',
            loading: false
        });

        await this.panel?.webview.postMessage({
            command: 'showSuccess',
            message: `Environment group "${groupName}" updated successfully!`
        });

        // Close webview after short delay
        setTimeout(() => {
            this.panel?.dispose();
            this.onGroupUpdated();
        }, 1500);
    }

    private async showError(message: string) {
        // Show error
        await this.panel?.webview.postMessage({
            command: 'setLoading',
            loading: false
        });

        await this.panel?.webview.postMessage({
            command: 'showError',
            message
        });
    }

    private getWebviewContent(): string {
        const currentColor = this.group.color ?? 'blue';
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Edit Environment Group: ${this.group.name}</title>
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
        
        .group-info {
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
        <h2>Edit Environment Group</h2>
        <div class="group-info">
            <strong>Group:</strong> ${this.group.name}<br>
            ${this.group.description ? `<strong>Description:</strong> ${this.group.description}<br>` : ''}
            <strong>Current Color:</strong> ${this.group.color ?? 'blue'}<br>
            <strong>Created:</strong> ${new Date(this.group.createdAt).toLocaleDateString()}
        </div>
    </div>
    
    <div class="form-container">
        <form id="environmentGroupForm">
            <div class="form-group">
                <label for="name">Group Name <span class="required">*</span></label>
                <input type="text" id="name" name="name" value="${this.group.name}" placeholder="e.g., Development Environments, Production Environments" required>
            </div>
              <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" placeholder="Brief description of this environment group (optional)">${this.group.description ?? ''}</textarea>
            </div>
            
            <div class="form-group">
                <label for="authType">Default Authentication Type</label>
                <select id="authType" name="authType">
                    <option value="none" ${(this.group.defaultAuth?.type ?? 'none') === 'none' ? 'selected' : ''}>🚫 No Authentication</option>
                    <option value="apikey" ${(this.group.defaultAuth?.type ?? 'none') === 'apikey' ? 'selected' : ''}>🔑 API Key</option>
                    <option value="bearer" ${(this.group.defaultAuth?.type ?? 'none') === 'bearer' ? 'selected' : ''}>🎫 Bearer Token</option>
                    <option value="basic" ${(this.group.defaultAuth?.type ?? 'none') === 'basic' ? 'selected' : ''}>👤 Basic Authentication</option>
                </select>
                <small style="color: var(--vscode-descriptionForeground); margin-top: 5px; display: block;">
                    This authentication will be used as the default for all environments in this group. Individual environments can override this setting.
                </small>
            </div>

            <!-- API Key Authentication Fields -->
            <div class="form-group auth-fields" id="apiKeyFields" style="display: none;">
                <label for="apiKey">API Key <span class="required">*</span></label>
                <input type="password" id="apiKey" name="apiKey" placeholder="Enter your API key">
                
                <label for="apiKeyLocation" style="margin-top: 15px;">API Key Location</label>
                <select id="apiKeyLocation" name="apiKeyLocation">
                    <option value="header" ${(this.group.defaultAuth?.apiKeyLocation ?? 'header') === 'header' ? 'selected' : ''}>HTTP Header</option>
                    <option value="query" ${(this.group.defaultAuth?.apiKeyLocation ?? 'header') === 'query' ? 'selected' : ''}>Query Parameter</option>
                </select>
                
                <label for="apiKeyName" style="margin-top: 15px;">API Key Name</label>
                <input type="text" id="apiKeyName" name="apiKeyName" value="${this.group.defaultAuth?.apiKeyName ?? 'X-API-Key'}" placeholder="e.g., X-API-Key, Authorization">
            </div>

            <!-- Bearer Token Authentication Fields -->
            <div class="form-group auth-fields" id="bearerFields" style="display: none;">
                <label for="bearerToken">Bearer Token <span class="required">*</span></label>
                <input type="password" id="bearerToken" name="bearerToken" placeholder="Enter your bearer token">
            </div>

            <!-- Basic Authentication Fields -->
            <div class="form-group auth-fields" id="basicFields" style="display: none;">
                <label for="username">Username <span class="required">*</span></label>
                <input type="text" id="username" name="username" value="${this.group.defaultAuth?.username ?? ''}" placeholder="Enter username">
                
                <label for="password" style="margin-top: 15px;">Password <span class="required">*</span></label>
                <input type="password" id="password" name="password" placeholder="Enter password">
            </div>
            
            <div class="form-group">
                <label for="color">Color Theme</label>
                <select id="color" name="color">
                    <option value="blue" ${currentColor === 'blue' ? 'selected' : ''}>🔵 Blue</option>
                    <option value="green" ${currentColor === 'green' ? 'selected' : ''}>🟢 Green</option>
                    <option value="orange" ${currentColor === 'orange' ? 'selected' : ''}>🟠 Orange</option>
                    <option value="purple" ${currentColor === 'purple' ? 'selected' : ''}>🟣 Purple</option>
                    <option value="red" ${currentColor === 'red' ? 'selected' : ''}>🔴 Red</option>
                    <option value="yellow" ${currentColor === 'yellow' ? 'selected' : ''}>🟡 Yellow</option>
                </select>
                <div class="color-preview">
                    <span>Preview:</span>
                    <div class="color-circle color-${currentColor}" id="colorPreview"></div>
                </div>
            </div>
            
            <div class="loading" id="loading">
                <div>🔄 Updating environment group...</div>
            </div>
            
            <div class="error" id="error"></div>
            <div class="success" id="success"></div>
            
            <div class="button-container">
                <button type="button" class="btn-secondary" onclick="cancelForm()">Cancel</button>
                <button type="submit" class="btn-primary" id="submitBtn">Update Environment Group</button>
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
        });        // Handle color change
        document.getElementById('color').addEventListener('change', function(e) {
            const color = e.target.value;
            const preview = document.getElementById('colorPreview');
            preview.className = 'color-circle color-' + color;
        });

        // Handle authentication type change
        document.getElementById('authType').addEventListener('change', function(e) {
            const authType = e.target.value;
            const authFields = document.querySelectorAll('.auth-fields');
            
            // Hide all auth fields
            authFields.forEach(field => {
                field.style.display = 'none';
            });
            
            // Show relevant auth fields
            switch (authType) {
                case 'apikey':
                    document.getElementById('apiKeyFields').style.display = 'block';
                    break;
                case 'bearer':
                    document.getElementById('bearerFields').style.display = 'block';
                    break;
                case 'basic':
                    document.getElementById('basicFields').style.display = 'block';
                    break;
            }
        });

        // Initialize auth fields visibility
        const initialAuthType = document.getElementById('authType').value;
        if (initialAuthType !== 'none') {
            document.getElementById('authType').dispatchEvent(new Event('change'));
        }

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
