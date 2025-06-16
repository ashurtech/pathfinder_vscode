import * as vscode from 'vscode';
import { ConfigurationManager } from '../configuration';
import { SchemaEnvironment } from '../types';

export class AddSchemaEnvironmentWebview {
    private panel: vscode.WebviewPanel | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly configManager: ConfigurationManager,
        private readonly schema: any,
        private readonly onEnvironmentAdded: () => void
    ) {}

    async show() {
        // Create and show a new webview panel
        this.panel = vscode.window.createWebviewPanel(
            'addSchemaEnvironment',
            `Add Environment for ${this.schema.name}`,
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
                    case 'validateUrl':
                        await this.handleUrlValidation(message.url);
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
                message: 'Creating environment...'
            });

            // Validate required fields
            if (!data.name?.trim()) {
                throw new Error('Environment name is required');
            }

            if (!data.baseUrl?.trim()) {
                throw new Error('Base URL is required');
            }

            // Validate URL format
            try {
                new URL(data.baseUrl.trim());
            } catch {
                throw new Error('Please enter a valid URL');
            }

            // Create new environment
            const secretPrefix = `pathfinder.env.${data.name.trim().replace(/\s+/g, '_').toLowerCase()}`;
            
            const newEnvironment: SchemaEnvironment = {
                id: `env_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                schemaId: this.schema.id,
                name: data.name.trim(),
                baseUrl: data.baseUrl.trim(),
                auth: { type: 'none' as const },
                createdAt: new Date()
            };

            if (data.description?.trim()) {
                newEnvironment.description = data.description.trim();
            }

            // Handle authentication
            if (data.authType && data.authType !== 'none') {
                switch (data.authType) {
                    case 'apikey':
                        if (!data.apiKey?.trim()) {
                            throw new Error('API Key is required for API Key authentication');
                        }                        newEnvironment.auth = {
                            type: 'apikey',
                            apiKeyLocation: data.apiKeyLocation || 'header',
                            apiKeyName: data.apiKeyName?.trim() || 'X-API-Key'
                        };
                        // Store API key securely
                        await this.configManager.storeSecret(`${secretPrefix}:apikey`, data.apiKey.trim());
                        (newEnvironment.auth as any)['keySecret'] = `${secretPrefix}:apikey`;
                        break;

                    case 'bearer':
                        if (!data.bearerToken?.trim()) {
                            throw new Error('Bearer token is required for Bearer Token authentication');
                        }
                        newEnvironment.auth = {
                            type: 'bearer'
                        };
                        // Store bearer token securely
                        await this.configManager.storeSecret(`${secretPrefix}:token`, data.bearerToken.trim());
                        (newEnvironment.auth as any)['tokenSecret'] = `${secretPrefix}:token`;
                        break;

                    case 'basic':
                        if (!data.username?.trim() || !data.password?.trim()) {
                            throw new Error('Username and password are required for Basic Authentication');
                        }
                        newEnvironment.auth = {
                            type: 'basic',
                            username: data.username.trim()
                        };
                        // Store password securely
                        await this.configManager.storeSecret(`${secretPrefix}:password`, data.password.trim());
                        (newEnvironment.auth as any)['passwordSecret'] = `${secretPrefix}:password`;
                        break;
                }
            }

            // Save the environment
            await this.configManager.saveSchemaEnvironment(newEnvironment);

            // Show success
            await this.panel?.webview.postMessage({
                command: 'setLoading',
                loading: false
            });

            await this.panel?.webview.postMessage({
                command: 'showSuccess',
                message: `Environment "${newEnvironment.name}" created successfully!`
            });

            // Close webview after short delay
            setTimeout(() => {
                this.panel?.dispose();
                this.onEnvironmentAdded();
            }, 1500);

        } catch (error) {
            console.error('Error creating environment:', error);
            
            // Show error
            await this.panel?.webview.postMessage({
                command: 'setLoading',
                loading: false
            });

            await this.panel?.webview.postMessage({
                command: 'showError',
                message: error instanceof Error ? error.message : 'Failed to create environment'
            });
        }
    }

    private async handleUrlValidation(url: string) {
        try {
            // Basic URL validation
            new URL(url);
            
            await this.panel?.webview.postMessage({
                command: 'urlValidationResult',
                isValid: true,
                message: 'URL format is valid'
            });
        } catch {
            await this.panel?.webview.postMessage({
                command: 'urlValidationResult',
                isValid: false,
                message: 'Please enter a valid URL (e.g., https://api.example.com)'
            });
        }
    }

    private getWebviewContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Add Environment for ${this.schema.name}</title>
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
            min-height: 60px;
        }
        
        .auth-section {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 20px;
            margin-top: 10px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
        }
        
        .auth-fields {
            margin-top: 15px;
        }
        
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
        
        .url-validation {
            margin-top: 5px;
            font-size: 0.9em;
            display: none;
        }
        
        .url-validation.valid {
            color: var(--vscode-terminal-ansiGreen);
            display: block;
        }
        
        .url-validation.invalid {
            color: var(--vscode-errorForeground);
            display: block;
        }
        
        .form-row {
            display: flex;
            gap: 15px;
        }
        
        .form-row .form-group {
            flex: 1;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>Add Environment for Schema</h2>
        <div class="schema-info">
            <strong>Schema:</strong> ${this.schema.name}<br>
            <strong>Version:</strong> v${this.schema.version}<br>
            ${this.schema.description ? `<strong>Description:</strong> ${this.schema.description}<br>` : ''}
            <strong>Source:</strong> ${this.schema.source}
        </div>
    </div>
    
    <div class="form-container">
        <form id="environmentForm">
            <div class="form-group">
                <label for="name">Environment Name <span class="required">*</span></label>
                <input type="text" id="name" name="name" placeholder="e.g., Development, Testing, Production" required>
            </div>
            
            <div class="form-group">
                <label for="baseUrl">Base URL <span class="required">*</span></label>
                <input type="url" id="baseUrl" name="baseUrl" placeholder="https://api.example.com" required>
                <div class="url-validation" id="urlValidation"></div>
            </div>
            
            <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" placeholder="Brief description of this environment (optional)"></textarea>
            </div>
            
            <div class="form-group">
                <label for="authType">Authentication Method</label>
                <select id="authType" name="authType">
                    <option value="none">No Authentication</option>
                    <option value="apikey">API Key</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="basic">Basic Authentication</option>
                </select>
                
                <div class="auth-section" id="authSection" style="display: none;">
                    <div class="auth-fields" id="authFields">
                        <!-- Dynamic auth fields will be inserted here -->
                    </div>
                </div>
            </div>
            
            <div class="loading" id="loading">
                <div>🔄 Creating environment...</div>
            </div>
            
            <div class="error" id="error"></div>
            <div class="success" id="success"></div>
            
            <div class="button-container">
                <button type="button" class="btn-secondary" onclick="cancelForm()">Cancel</button>
                <button type="submit" class="btn-primary" id="submitBtn">Create Environment</button>
            </div>
        </form>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let urlValidationTimeout;

        // Handle form submission
        document.getElementById('environmentForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            
            vscode.postMessage({
                command: 'submitForm',
                data: data
            });
        });

        // Handle auth type change
        document.getElementById('authType').addEventListener('change', function(e) {
            const authType = e.target.value;
            const authSection = document.getElementById('authSection');
            const authFields = document.getElementById('authFields');
            
            if (authType === 'none') {
                authSection.style.display = 'none';
                return;
            }
            
            authSection.style.display = 'block';
            
            // Clear previous fields
            authFields.innerHTML = '';
            
            if (authType === 'apikey') {
                authFields.innerHTML = \`
                    <div class="form-group">
                        <label for="apiKey">API Key <span class="required">*</span></label>
                        <input type="password" id="apiKey" name="apiKey" placeholder="Enter your API key" required>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="apiKeyLocation">Location</label>
                            <select id="apiKeyLocation" name="apiKeyLocation">
                                <option value="header">Header</option>
                                <option value="query">Query Parameter</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="apiKeyName">Parameter Name</label>
                            <input type="text" id="apiKeyName" name="apiKeyName" value="X-API-Key" placeholder="X-API-Key">
                        </div>
                    </div>
                \`;
            } else if (authType === 'bearer') {
                authFields.innerHTML = \`
                    <div class="form-group">
                        <label for="bearerToken">Bearer Token <span class="required">*</span></label>
                        <input type="password" id="bearerToken" name="bearerToken" placeholder="Enter your bearer token" required>
                    </div>
                \`;
            } else if (authType === 'basic') {
                authFields.innerHTML = \`
                    <div class="form-row">
                        <div class="form-group">
                            <label for="username">Username <span class="required">*</span></label>
                            <input type="text" id="username" name="username" placeholder="Enter username" required>
                        </div>
                        <div class="form-group">
                            <label for="password">Password <span class="required">*</span></label>
                            <input type="password" id="password" name="password" placeholder="Enter password" required>
                        </div>
                    </div>
                \`;
            }
        });

        // Handle URL validation with debouncing
        document.getElementById('baseUrl').addEventListener('input', function(e) {
            const url = e.target.value.trim();
            const validation = document.getElementById('urlValidation');
            
            // Clear previous timeout
            if (urlValidationTimeout) {
                clearTimeout(urlValidationTimeout);
            }
            
            if (!url) {
                validation.className = 'url-validation';
                validation.textContent = '';
                return;
            }
            
            // Set timeout for validation
            urlValidationTimeout = setTimeout(() => {
                vscode.postMessage({
                    command: 'validateUrl',
                    url: url
                });
            }, 500);
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
                    
                case 'urlValidationResult':
                    const validation = document.getElementById('urlValidation');
                    
                    if (message.isValid) {
                        validation.className = 'url-validation valid';
                        validation.textContent = '✓ ' + message.message;
                    } else {
                        validation.className = 'url-validation invalid';
                        validation.textContent = '⚠ ' + message.message;
                    }
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
