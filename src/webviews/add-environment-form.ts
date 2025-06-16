import * as vscode from 'vscode';
import { ConfigurationManager } from '../configuration';

export class AddEnvironmentWebview {
    private panel: vscode.WebviewPanel | undefined;    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly configManager: ConfigurationManager,
        private readonly onEnvironmentAdded: () => void
    ) {}

    async show() {
        // Create and show a new webview panel
        this.panel = vscode.window.createWebviewPanel(
            'addEnvironment',
            'Add New Environment',
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
                    case 'validateUrl':
                        await this.handleUrlValidation(message.url);
                        break;
                }
            }
        );
    }

    private async handleSubmit(data: any) {
        try {
            // Validate required fields
            if (!data.name || !data.baseUrl) {
                vscode.window.showErrorMessage('Name and Base URL are required');
                return;
            }

            // Create the environment
            const environment: SchemaEnvironment = {
                id: `env_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                schemaId: this.schema.id,
                name: data.name,
                baseUrl: data.baseUrl,
                description: data.description || '',
                auth: { type: 'none' },
                customHeaders: data.customHeaders || {},
                timeout: data.timeout || 30000,
                createdAt: new Date(),
                lastUsed: new Date()
            };

            // If credentials were provided, store them
            if (data.auth?.type !== 'none') {
                let credentials: { username?: string; password?: string; apiKey?: string } = {};
                
                switch (data.auth.type) {
                    case 'basic':
                        credentials = {
                            username: data.auth.username,
                            password: data.auth.password
                        };
                        break;
                    case 'apikey':
                        credentials = {
                            apiKey: data.auth.apiKey
                        };
                        break;
                }

                // Store credentials and get the secret key
                const secretKey = await this.configManager.setCredentials(environment, credentials);
                environment.authSecretKey = secretKey;
            }

            // Save the environment
            await this.configManager.saveSchemaEnvironment(environment);

            // Close the webview
            this.dispose();

            // Refresh the tree view
            this.onEnvironmentAdded();

            vscode.window.showInformationMessage(`Environment "${data.name}" created successfully!`);

        } catch (error) {
            console.error('Failed to create environment:', error);
            vscode.window.showErrorMessage(`Failed to create environment: ${error}`);
        }
    }

    private async handleUrlValidation(url: string) {
        try {
            new URL(url);
            await this.panel?.webview.postMessage({
                command: 'urlValidationResult',
                valid: true
            });
        } catch {
            await this.panel?.webview.postMessage({
                command: 'urlValidationResult',
                valid: false,
                error: 'Invalid URL format'
            });
        }
    }

    private getWebviewContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Add Environment</title>
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
        
        input, textarea, select {
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
        
        input:focus, textarea:focus, select:focus {
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
        
        .validation-message {
            font-size: 12px;
            margin-top: 4px;
        }
        
        .validation-message.error {
            color: var(--vscode-errorForeground);
        }
        
        .validation-message.success {
            color: var(--vscode-charts-green);
        }
        
        .auth-section {
            border: 1px solid var(--vscode-widget-border);
            border-radius: 5px;
            padding: 15px;
            margin-top: 10px;
            background-color: var(--vscode-editor-background);
        }
        
        .auth-fields {
            margin-top: 15px;
        }
        
        .auth-field-group {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }
        
        .auth-field-group .form-group {
            flex: 1;
            margin-bottom: 0;
        }
        
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
        
        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Add New Environment</h1>
        
        <div class="error-message" id="errorMessage"></div>
        
        <form id="environmentForm">
            <div class="form-group">
                <label for="name">Environment Name <span class="required">*</span></label>
                <input type="text" id="name" name="name" required placeholder="e.g., 'Kibana APAC Test'">
                <div class="hint">A descriptive name for this environment</div>
            </div>
            
            <div class="form-group">
                <label for="baseUrl">Base URL <span class="required">*</span></label>
                <input type="url" id="baseUrl" name="baseUrl" required placeholder="e.g., 'https://api.example.com'">
                <div class="validation-message" id="urlValidation" style="display: none;"></div>
                <div class="hint">The base URL for API requests in this environment</div>
            </div>
            
            <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" placeholder="Brief description of this environment (optional)"></textarea>
                <div class="hint">Optional description to help identify this environment</div>
            </div>
            
            <div class="form-group">
                <label for="authType">Authentication Method <span class="required">*</span></label>
                <select id="authType" name="authType" required>
                    <option value="none">No Authentication</option>
                    <option value="apikey">API Key</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="basic">Basic Authentication</option>
                </select>
                
                <div class="auth-section">
                    <div id="authFields" class="auth-fields"></div>
                </div>
            </div>
        </form>
        
        <div class="buttons">
            <button type="button" class="button button-secondary" id="cancelButton">Cancel</button>
            <button type="submit" class="button button-primary" id="submitButton" form="environmentForm">Create Environment</button>
        </div>
    </div>
    
    <div class="loading" id="loadingMessage">
        <div>⏳ Creating environment...</div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        // Form elements
        const form = document.getElementById('environmentForm');
        const nameInput = document.getElementById('name');
        const baseUrlInput = document.getElementById('baseUrl');
        const descriptionInput = document.getElementById('description');
        const authTypeSelect = document.getElementById('authType');
        const authFieldsContainer = document.getElementById('authFields');
        const submitButton = document.getElementById('submitButton');
        const cancelButton = document.getElementById('cancelButton');
        const errorMessage = document.getElementById('errorMessage');
        const loadingMessage = document.getElementById('loadingMessage');
        const urlValidation = document.getElementById('urlValidation');
        
        // Auth type change handler
        authTypeSelect.addEventListener('change', () => {
            updateAuthFields();
        });
        
        function updateAuthFields() {
            const authType = authTypeSelect.value;
            authFieldsContainer.innerHTML = '';
            
            if (authType === 'none') {
                authFieldsContainer.innerHTML = '<div class="hint">No authentication will be used for this environment.</div>';
            } else if (authType === 'apikey') {
                authFieldsContainer.innerHTML = \`
                    <div class="form-group">
                        <label for="apiKey">API Key <span class="required">*</span></label>
                        <input type="password" id="apiKey" name="apiKey" required placeholder="Enter your API key">
                    </div>
                    <div class="auth-field-group">
                        <div class="form-group">
                            <label for="apiKeyLocation">Location <span class="required">*</span></label>
                            <select id="apiKeyLocation" name="apiKeyLocation" required>
                                <option value="header">Header</option>
                                <option value="query">Query Parameter</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="apiKeyName">Parameter/Header Name <span class="required">*</span></label>
                            <input type="text" id="apiKeyName" name="apiKeyName" required placeholder="e.g., 'X-API-Key' or 'api_key'">
                        </div>
                    </div>
                \`;
            } else if (authType === 'bearer') {
                authFieldsContainer.innerHTML = \`
                    <div class="form-group">
                        <label for="bearerToken">Bearer Token <span class="required">*</span></label>
                        <input type="password" id="bearerToken" name="bearerToken" required placeholder="Enter your bearer token">
                    </div>
                \`;
            } else if (authType === 'basic') {
                authFieldsContainer.innerHTML = \`
                    <div class="auth-field-group">
                        <div class="form-group">
                            <label for="username">Username <span class="required">*</span></label>
                            <input type="text" id="username" name="username" required placeholder="Enter your username">
                        </div>
                        <div class="form-group">
                            <label for="password">Password <span class="required">*</span></label>
                            <input type="password" id="password" name="password" required placeholder="Enter your password">
                        </div>
                    </div>
                \`;
            }
        }
        
        // URL validation (debounced)
        let validationTimeout;
        baseUrlInput.addEventListener('input', () => {
            clearTimeout(validationTimeout);
            if (baseUrlInput.value.trim()) {
                validationTimeout = setTimeout(() => {
                    vscode.postMessage({
                        command: 'validateUrl',
                        url: baseUrlInput.value.trim()
                    });
                }, 500);
            } else {
                clearValidation();
            }
        });
        
        function clearValidation() {
            urlValidation.style.display = 'none';
            urlValidation.textContent = '';
        }
        
        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const data = {};
            
            // Get all form data
            for (let [key, value] of formData.entries()) {
                data[key] = value;
            }
            
            // Get auth fields dynamically
            const authType = authTypeSelect.value;
            if (authType === 'apikey') {
                const apiKeyInput = document.getElementById('apiKey');
                const locationSelect = document.getElementById('apiKeyLocation');
                const nameInput = document.getElementById('apiKeyName');
                data.apiKey = apiKeyInput?.value;
                data.apiKeyLocation = locationSelect?.value;
                data.apiKeyName = nameInput?.value;
            } else if (authType === 'bearer') {
                const tokenInput = document.getElementById('bearerToken');
                data.bearerToken = tokenInput?.value;
            } else if (authType === 'basic') {
                const usernameInput = document.getElementById('username');
                const passwordInput = document.getElementById('password');
                data.username = usernameInput?.value;
                data.password = passwordInput?.value;
            }
            
            // Basic validation
            if (!data.name?.trim()) {
                showError('Environment name is required');
                return;
            }
            
            if (!data.baseUrl?.trim()) {
                showError('Base URL is required');
                return;
            }
            
            // Auth-specific validation
            if (authType === 'apikey' && (!data.apiKey || !data.apiKeyName)) {
                showError('API key and parameter name are required');
                return;
            }
            
            if (authType === 'bearer' && !data.bearerToken) {
                showError('Bearer token is required');
                return;
            }
            
            if (authType === 'basic' && (!data.username || !data.password)) {
                showError('Username and password are required');
                return;
            }
            
            vscode.postMessage({
                command: 'submitForm',
                data: data
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
                case 'urlValidationResult':
                    handleUrlValidation(message);
                    break;
            }
        });
        
        function setLoading(loading, message = 'Creating environment...') {
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
        
        function handleUrlValidation(result) {
            if (result.valid) {
                urlValidation.textContent = '✅ Valid URL format';
                urlValidation.className = 'validation-message success';
            } else {
                urlValidation.textContent = \`❌ \${result.error}\`;
                urlValidation.className = 'validation-message error';
            }
            urlValidation.style.display = 'block';
        }
        
        // Initialize auth fields
        updateAuthFields();
    </script>
</body>
</html>`;
    }
}
