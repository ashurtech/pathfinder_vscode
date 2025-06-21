import * as vscode from 'vscode';
import { ConfigurationManager } from '../configuration';
import { SchemaEnvironmentGroup } from '../types';

export class AddEnvironmentGroupWebview {
    private panel: vscode.WebviewPanel | undefined;
    private readonly schemaId: string;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly configManager: ConfigurationManager,
        schemaId: string,
        private readonly onSave: () => void
    ) {
        this.schemaId = schemaId;
    }

    async show() {
        // Create and show a new webview panel
        this.panel = vscode.window.createWebviewPanel(
            'addEnvironmentGroup',
            'Add New Environment Group',
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
                        await this.handleSubmit(message.data);
                        break;
                    case 'cancel':
                        this.panel?.dispose();
                        break;
                }
            }
        );
    }    private async handleSubmit(data: any) {
        try {
            // Validate required fields
            if (!data.name) {
                vscode.window.showErrorMessage('Name is required');
                return;
            }

            // Create the group
            const group: SchemaEnvironmentGroup = {
                id: `group_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                schemaId: this.schemaId,
                name: data.name,                description: data.description ?? '',
                color: data.color ?? 'blue',
                createdAt: new Date(),
                defaultAuth: { type: 'none' },
                authSecretKey: undefined
            };

            // Handle authentication if provided
            if (data.auth?.type && data.auth.type !== 'none') {
                let credentials: { username?: string; password?: string; apiKey?: string } = {};
                
                switch (data.auth.type) {
                    case 'apikey':
                        group.defaultAuth = {
                            type: 'apikey',                            apiKeyLocation: data.auth.apiKeyLocation ?? 'header',
                            apiKeyName: data.auth.apiKeyName ?? 'X-API-Key'
                        };
                        credentials = { apiKey: data.auth.apiKey };
                        break;
                    case 'bearer':
                        group.defaultAuth = { type: 'bearer' };
                        credentials = { apiKey: data.auth.bearerToken };
                        break;
                    case 'basic':
                        group.defaultAuth = { type: 'basic', username: data.auth.username };
                        credentials = {
                            username: data.auth.username,
                            password: data.auth.password
                        };
                        break;
                }

                // Store credentials and get the secret key
                const secretKey = await this.configManager.setCredentials(group, credentials);
                group.authSecretKey = secretKey;
            }

            // Save the group
            await this.configManager.saveSchemaEnvironmentGroup(group);

            // Close the webview
            this.dispose();

            // Refresh the tree view
            this.onSave();

            vscode.window.showInformationMessage(`Environment group "${data.name}" created successfully!`);

        } catch (error) {
            console.error('Failed to create environment group:', error);
            vscode.window.showErrorMessage(`Failed to create environment group: ${error}`);
        }
    }

    private getWebviewContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Add Environment Group</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
            line-height: 1.6;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
        }
        
        h1 {
            color: var(--vscode-foreground);
            margin-bottom: 30px;
            font-size: 24px;
            font-weight: 600;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: var(--vscode-foreground);
        }
        
        .required {
            color: var(--vscode-errorForeground);
        }
        
        input, textarea {
            width: 100%;
            padding: 10px;
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
            box-shadow: 0 0 0 1px var(--vscode-focusBorder);
        }
        
        textarea {
            resize: vertical;
            min-height: 80px;
        }
        
        .hint {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
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
        
        .color-option:focus:not(:focus-visible) {
            outline: none;
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
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 5px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            display: none;
        }
        
        .loading.show {
            display: block;
        }
        
        .error-message {
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-inputValidation-errorForeground);
            padding: 10px;
            border-radius: 3px;
            margin-bottom: 20px;
            display: none;
        }
        
        .error-message.show {
            display: block;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Add New Environment Group</h1>
        
        <div class="error-message" id="errorMessage"></div>
        
        <form id="groupForm">
            <div class="form-group">
                <label for="name">Group Name <span class="required">*</span></label>
                <input type="text" id="name" name="name" required placeholder="e.g., 'Kibana Environments', 'Production APIs'">
                <div class="hint">A descriptive name for this environment group</div>
            </div>
            
            <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" placeholder="e.g., 'All Kibana test environments'"></textarea>
                <div class="hint">Optional description to help identify this group</div>
            </div>
              <div class="form-group">
                <label>Color Theme</label>
                <div class="color-group">
                    <div class="color-option color-blue selected" data-color="blue" title="Blue" role="button" aria-label="Select blue color theme" tabindex="0" aria-pressed="true"></div>
                    <div class="color-option color-green" data-color="green" title="Green" role="button" aria-label="Select green color theme" tabindex="0" aria-pressed="false"></div>
                    <div class="color-option color-orange" data-color="orange" title="Orange" role="button" aria-label="Select orange color theme" tabindex="0" aria-pressed="false"></div>
                    <div class="color-option color-purple" data-color="purple" title="Purple" role="button" aria-label="Select purple color theme" tabindex="0" aria-pressed="false"></div>
                    <div class="color-option color-red" data-color="red" title="Red" role="button" aria-label="Select red color theme" tabindex="0" aria-pressed="false"></div>
                    <div class="color-option color-yellow" data-color="yellow" title="Yellow" role="button" aria-label="Select yellow color theme" tabindex="0" aria-pressed="false"></div>
                </div>
                <div class="hint">Choose a color for visual identification in the tree view</div>
            </div>

            <div class="form-group">
                <label for="authType">Default Authentication Type</label>
                <select id="authType" name="authType">
                    <option value="none">🚫 No Authentication</option>
                    <option value="apikey">🔑 API Key</option>
                    <option value="bearer">🎫 Bearer Token</option>
                    <option value="basic">👤 Basic Authentication</option>
                </select>
                <div class="hint">This authentication will be used as the default for all environments in this group. Individual environments can override this setting.</div>
            </div>

            <!-- API Key Authentication Fields -->
            <div class="form-group auth-fields" id="apiKeyFields" style="display: none;">
                <label for="apiKey">API Key <span class="required">*</span></label>
                <input type="password" id="apiKey" name="apiKey" placeholder="Enter your API key">
                
                <label for="apiKeyLocation" style="margin-top: 15px;">API Key Location</label>
                <select id="apiKeyLocation" name="apiKeyLocation">
                    <option value="header">HTTP Header</option>
                    <option value="query">Query Parameter</option>
                </select>
                
                <label for="apiKeyName" style="margin-top: 15px;">API Key Name</label>
                <input type="text" id="apiKeyName" name="apiKeyName" value="X-API-Key" placeholder="e.g., X-API-Key, Authorization">
            </div>

            <!-- Bearer Token Authentication Fields -->
            <div class="form-group auth-fields" id="bearerFields" style="display: none;">
                <label for="bearerToken">Bearer Token <span class="required">*</span></label>
                <input type="password" id="bearerToken" name="bearerToken" placeholder="Enter your bearer token">
            </div>

            <!-- Basic Authentication Fields -->
            <div class="form-group auth-fields" id="basicFields" style="display: none;">
                <label for="username">Username <span class="required">*</span></label>
                <input type="text" id="username" name="username" placeholder="Enter username">
                
                <label for="password" style="margin-top: 15px;">Password <span class="required">*</span></label>
                <input type="password" id="password" name="password" placeholder="Enter password">
            </div>
        </form>
        
        <div class="buttons">
            <button type="button" class="button button-secondary" id="cancelButton">Cancel</button>
            <button type="submit" class="button button-primary" id="submitButton" form="groupForm">Create Group</button>
        </div>
    </div>
    
    <div class="loading" id="loadingMessage">
        <div>⏳ Creating group...</div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        // Form elements
        const form = document.getElementById('groupForm');
        const nameInput = document.getElementById('name');
        const descriptionInput = document.getElementById('description');
        const submitButton = document.getElementById('submitButton');
        const cancelButton = document.getElementById('cancelButton');
        const errorMessage = document.getElementById('errorMessage');
        const loadingMessage = document.getElementById('loadingMessage');
          // Color selection
        let selectedColor = 'blue';
        
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

        // Authentication type handling
        const authTypeSelect = document.getElementById('authType');
        const authFields = document.querySelectorAll('.auth-fields');
        
        authTypeSelect.addEventListener('change', function(e) {
            const authType = e.target.value;
            
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
        
        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const formData = {
                name: nameInput.value.trim(),
                description: descriptionInput.value.trim(),
                color: selectedColor,
                auth: {
                    type: authTypeSelect.value
                }
            };

            // Add authentication data based on type
            if (authTypeSelect.value !== 'none') {
                switch (authTypeSelect.value) {
                    case 'apikey':
                        formData.auth.apiKey = document.getElementById('apiKey').value.trim();
                        formData.auth.apiKeyLocation = document.getElementById('apiKeyLocation').value;
                        formData.auth.apiKeyName = document.getElementById('apiKeyName').value.trim();
                        
                        if (!formData.auth.apiKey) {
                            showError('API Key is required for API Key authentication');
                            return;
                        }
                        break;
                    case 'bearer':
                        formData.auth.bearerToken = document.getElementById('bearerToken').value.trim();
                        
                        if (!formData.auth.bearerToken) {
                            showError('Bearer token is required for Bearer Token authentication');
                            return;
                        }
                        break;
                    case 'basic':
                        formData.auth.username = document.getElementById('username').value.trim();
                        formData.auth.password = document.getElementById('password').value.trim();
                        
                        if (!formData.auth.username || !formData.auth.password) {
                            showError('Username and password are required for Basic Authentication');
                            return;
                        }
                        break;
                }
            }
            
            // Basic validation
            if (!formData.name) {
                showError('Group name is required');
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
        
        function setLoading(loading, message = 'Creating group...') {
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
    </script>
</body>
</html>`;
    }

    public dispose() {
        this.panel?.dispose();
        this.panel = undefined;
    }
}
