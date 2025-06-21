import * as vscode from 'vscode';
import { ConfigurationManager } from '../configuration';

export class AddEnvironmentToGroupWebview {
    private panel: vscode.WebviewPanel | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly configManager: ConfigurationManager,
        private readonly group: any,
        private readonly schema: any,
        private readonly onEnvironmentAdded: () => void
    ) {}

    async show() {
        // Create and show a new webview panel
        this.panel = vscode.window.createWebviewPanel(
            'addEnvironmentToGroup',
            `Add Environment to ${this.group.name}`,
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
                loading: true
            });

            // Validate required fields
            if (!data.name?.trim()) {
                await this.panel?.webview.postMessage({
                    command: 'showError',
                    error: 'Environment name is required'
                });
                return;
            }

            if (!data.baseUrl?.trim()) {
                await this.panel?.webview.postMessage({
                    command: 'showError',
                    error: 'Base URL is required'
                });
                return;
            }

            // Validate URL format
            try {
                new URL(data.baseUrl.trim());
            } catch {
                await this.panel?.webview.postMessage({
                    command: 'showError',
                    error: 'Please enter a valid URL'
                });
                return;            }

            // Create the new environment object
            const newEnvironment: any = {
                id: `env_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                schemaId: this.schema.id,
                environmentGroupId: this.group.id,
                name: data.name.trim(),
                baseUrl: data.baseUrl.trim(),
                description: data.description?.trim() ?? undefined,
                auth: { type: 'none' },
                createdAt: new Date()
            };

            // Handle authentication
            if (data.inheritAuth && this.group.defaultAuth?.type !== 'none') {
                // Inherit authentication from the group
                newEnvironment.auth = { type: 'inherit' };
                // The auth credentials will be resolved from the parent group at runtime
            } else if (data.auth?.type && data.auth.type !== 'none' && data.auth.type !== 'inherit') {
                // Use custom authentication for this environment
                switch (data.auth.type) {
                    case 'apikey': {
                        if (!data.auth.apiKey?.trim()) {
                            throw new Error('API Key is required for API Key Authentication');
                        }
                        newEnvironment.auth = {
                            type: 'apikey',
                            keyName: data.auth.keyName?.trim() ?? 'X-API-Key'
                        };
                        // Store API key securely
                        const apiKeySecretKey = await this.configManager.setCredentials(newEnvironment, {
                            apiKey: data.auth.apiKey.trim()
                        });
                        newEnvironment.authSecretKey = apiKeySecretKey;
                        break;
                    }

                    case 'bearer': {
                        if (!data.auth.token?.trim()) {
                            throw new Error('Bearer token is required for Bearer Authentication');
                        }
                        newEnvironment.auth = {
                            type: 'bearer'
                        };
                        // Store bearer token securely
                        const bearerSecretKey = await this.configManager.setCredentials(newEnvironment, {
                            apiKey: data.auth.token.trim()
                        });
                        newEnvironment.authSecretKey = bearerSecretKey;
                        break;
                    }

                    case 'basic': {
                        if (!data.auth.username?.trim() || !data.auth.password?.trim()) {
                            throw new Error('Username and password are required for Basic Authentication');
                        }
                        newEnvironment.auth = {
                            type: 'basic',
                            username: data.auth.username.trim()
                        };
                        // Store password securely
                        const basicSecretKey = await this.configManager.setCredentials(newEnvironment, {
                            username: data.auth.username.trim(),
                            password: data.auth.password.trim()
                        });
                        newEnvironment.authSecretKey = basicSecretKey;
                        break;
                    }
                }
            }

            // Save the environment
            await this.configManager.saveSchemaEnvironment(newEnvironment);

            // Show success message
            vscode.window.showInformationMessage(`Environment "${newEnvironment.name}" added to group "${this.group.name}"!`);

            // Call the callback to refresh the tree
            this.onEnvironmentAdded();

            // Close the panel
            this.panel?.dispose();

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await this.panel?.webview.postMessage({
                command: 'showError',
                error: `Failed to add environment: ${errorMessage}`
            });
            vscode.window.showErrorMessage(`Failed to add environment: ${errorMessage}`);
        } finally {
            // Hide loading state
            await this.panel?.webview.postMessage({
                command: 'setLoading',
                loading: false
            });
        }
    }

    private async handleUrlValidation(url: string) {
        try {
            if (!url) {
                await this.panel?.webview.postMessage({
                    command: 'urlValidation',
                    valid: false,
                    error: 'URL is required'
                });
                return;
            }

            new URL(url);
            await this.panel?.webview.postMessage({
                command: 'urlValidation',
                valid: true,
                error: null
            });
        } catch {
            await this.panel?.webview.postMessage({
                command: 'urlValidation',
                valid: false,
                error: 'Please enter a valid URL'
            });
        }
    }

    private getWebviewContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Add Environment to Group</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            font-weight: var(--vscode-font-weight);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
            line-height: 1.5;
        }

        .container {
            max-width: 600px;
            margin: 0 auto;
        }

        h1 {
            color: var(--vscode-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
            margin-bottom: 30px;
            font-size: 24px;
            font-weight: 600;
        }

        .context-info {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            padding: 12px 16px;
            margin-bottom: 24px;
            border-radius: 4px;
        }

        .context-info h3 {
            margin: 0 0 8px 0;
            color: var(--vscode-textPreformat-foreground);
            font-size: 14px;
            font-weight: 600;
        }

        .context-info p {
            margin: 0;
            color: var(--vscode-descriptionForeground);
            font-size: 13px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        label {
            display: block;
            margin-bottom: 6px;
            color: var(--vscode-foreground);
            font-weight: 500;
        }

        .required {
            color: var(--vscode-errorForeground);
        }

        input[type="text"], 
        input[type="url"],
        textarea {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            box-sizing: border-box;
        }

        input[type="text"]:focus, 
        input[type="url"]:focus,
        textarea:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 1px var(--vscode-focusBorder);
        }

        textarea {
            resize: vertical;
            min-height: 80px;
        }

        .validation-error {
            color: var(--vscode-errorForeground);
            font-size: 12px;
            margin-top: 4px;
            display: none;
        }

        .validation-success {
            color: var(--vscode-terminal-ansiGreen);
            font-size: 12px;
            margin-top: 4px;
            display: none;
        }

        .button-group {
            display: flex;
            gap: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
        }

        button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            font-weight: 500;
            transition: all 0.2s ease;
        }

        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .btn-primary:hover:not(:disabled) {
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

        .error-message {
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-inputValidation-errorForeground);
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 20px;
            display: none;
        }

        .loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }

        .loading-spinner {
            border: 3px solid var(--vscode-progressBar-background);
            border-top: 3px solid var(--vscode-progressBar-foreground);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }        .help-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }

        .auth-section {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 20px;
        }

        .auth-section.disabled {
            opacity: 0.6;
            background-color: var(--vscode-input-background);
        }

        .auth-section h3 {
            margin: 0 0 15px 0;
            font-size: 16px;
            color: var(--vscode-foreground);
            font-weight: 600;
        }

        .toggle-section {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            gap: 10px;
        }

        .toggle {
            position: relative;
            display: inline-block;
            width: 44px;
            height: 24px;
        }

        .toggle input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: var(--vscode-button-secondaryBackground);
            transition: .4s;
            border-radius: 24px;
        }

        .slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }

        input:checked + .slider {
            background-color: var(--vscode-button-background);
        }

        input:checked + .slider:before {
            transform: translateX(20px);
        }

        .inherit-info {
            background-color: var(--vscode-textCodeBlock-background);
            border-left: 4px solid var(--vscode-textLink-foreground);
            padding: 12px;
            margin-bottom: 15px;
            border-radius: 4px;
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
        }

        .inherit-info.show {
            display: block;
        }

        .inherit-info.hide {
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Add Environment to Group</h1>
        
        <div class="context-info">
            <h3>Context</h3>
            <p><strong>Schema:</strong> ${this.schema.name}</p>
            <p><strong>Environment Group:</strong> ${this.group.name}</p>
            <p>Add a new environment to this group within the schema context.</p>
        </div>

        <div class="error-message" id="errorMessage"></div>

        <form id="environmentForm">
            <div class="form-group">
                <label for="name">Environment Name <span class="required">*</span></label>
                <input type="text" id="name" name="name" placeholder="e.g., Development Server, Test Environment" required />
                <div class="validation-error" id="nameError"></div>
                <div class="help-text">A descriptive name for this environment</div>
            </div>

            <div class="form-group">
                <label for="baseUrl">Base URL <span class="required">*</span></label>
                <input type="url" id="baseUrl" name="baseUrl" placeholder="e.g., https://api.example.com" required />
                <div class="validation-error" id="baseUrlError"></div>
                <div class="validation-success" id="baseUrlSuccess">✓ Valid URL format</div>
                <div class="help-text">The base URL for API requests in this environment</div>
            </div>            <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" placeholder="Optional description for this environment..."></textarea>
                <div class="help-text">Optional description to help identify this environment</div>
            </div>

            <div class="auth-section" id="authSection">
                <h3>Authentication Settings</h3>
                
                <div class="inherit-info" id="inheritInfo">
                    <strong>Inherit from Group:</strong> This environment will use the authentication settings from the "${this.group.name}" group.
                </div>
                
                <div class="toggle-section">
                    <label class="toggle">
                        <input type="checkbox" id="inheritAuth" checked>
                        <span class="slider"></span>
                    </label>
                    <label for="inheritAuth" style="cursor: pointer;">Inherit authentication from group</label>
                </div>

                <div id="customAuthFields">
                    <div class="form-group">
                        <label for="authType">Authentication Type</label>
                        <select id="authType" name="auth.type">
                            <option value="none">No Authentication</option>
                            <option value="apikey">API Key</option>
                            <option value="bearer">Bearer Token</option>
                            <option value="basic">Basic Authentication</option>
                        </select>
                        <div class="help-text">Select the authentication method for this environment</div>
                    </div>

                    <!-- API Key Authentication Fields -->
                    <div id="apikeyFields" class="auth-fields">
                        <div class="form-group">
                            <label for="keyName">Key Name</label>
                            <input type="text" id="keyName" name="auth.keyName" placeholder="e.g., 'X-API-Key'">
                            <div class="help-text">The header name for the API key</div>
                        </div>
                        <div class="form-group">
                            <label for="apiKey">API Key <span class="required">*</span></label>
                            <input type="password" id="apiKey" name="auth.apiKey" placeholder="Enter your API key">
                            <div class="help-text">The API key value</div>
                        </div>
                    </div>

                    <!-- Bearer Token Authentication Fields -->
                    <div id="bearerFields" class="auth-fields">
                        <div class="form-group">
                            <label for="bearerToken">Bearer Token <span class="required">*</span></label>
                            <input type="password" id="bearerToken" name="auth.token" placeholder="Enter your bearer token">
                            <div class="help-text">The bearer token value</div>
                        </div>
                    </div>

                    <!-- Basic Authentication Fields -->
                    <div id="basicFields" class="auth-fields">
                        <div class="form-group">
                            <label for="username">Username <span class="required">*</span></label>
                            <input type="text" id="username" name="auth.username" placeholder="Enter username">
                            <div class="help-text">The username for basic authentication</div>
                        </div>
                        <div class="form-group">
                            <label for="password">Password <span class="required">*</span></label>
                            <input type="password" id="password" name="auth.password" placeholder="Enter password">
                            <div class="help-text">The password for basic authentication</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="button-group">
                <button type="submit" class="btn-primary" id="submitBtn">
                    Add Environment
                </button>
                <button type="button" class="btn-secondary" id="cancelBtn">
                    Cancel
                </button>
            </div>
        </form>
    </div>

    <div class="loading-overlay" id="loadingOverlay">
        <div class="loading-spinner"></div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();        // Form elements
        const form = document.getElementById('environmentForm');
        const nameInput = document.getElementById('name');
        const baseUrlInput = document.getElementById('baseUrl');
        const descriptionInput = document.getElementById('description');
        const authTypeSelect = document.getElementById('authType');
        const submitBtn = document.getElementById('submitBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const errorMessage = document.getElementById('errorMessage');
        const loadingOverlay = document.getElementById('loadingOverlay');

        // Authentication elements
        const inheritAuthToggle = document.getElementById('inheritAuth');
        const authSection = document.getElementById('authSection');
        const inheritInfo = document.getElementById('inheritInfo');
        const customAuthFields = document.getElementById('customAuthFields');

        // Validation elements
        const nameError = document.getElementById('nameError');
        const baseUrlError = document.getElementById('baseUrlError');
        const baseUrlSuccess = document.getElementById('baseUrlSuccess');

        // Authentication fields
        const apikeyFields = document.getElementById('apikeyFields');
        const bearerFields = document.getElementById('bearerFields');
        const basicFields = document.getElementById('basicFields');

        // Form validation
        let isValidUrl = false;

        // Initialize inherit authentication state based on group auth
        const groupHasAuth = ${(this.group.defaultAuth?.type ?? 'none') !== 'none'};
        if (groupHasAuth) {
            inheritAuthToggle.checked = true;
            inheritInfo.classList.add('show');
            inheritInfo.classList.remove('hide');
            customAuthFields.style.display = 'none';
        } else {
            inheritAuthToggle.checked = false;
            inheritInfo.classList.add('hide');
            inheritInfo.classList.remove('show');
            customAuthFields.style.display = 'block';
        }

        // Handle inherit authentication toggle
        inheritAuthToggle.addEventListener('change', () => {
            const isInheriting = inheritAuthToggle.checked;
            
            if (isInheriting) {
                inheritInfo.classList.add('show');
                inheritInfo.classList.remove('hide');
                customAuthFields.style.display = 'none';
                authSection.classList.add('disabled');
            } else {
                inheritInfo.classList.add('hide');
                inheritInfo.classList.remove('show');
                customAuthFields.style.display = 'block';
                authSection.classList.remove('disabled');
            }
            
            updateSubmitButton();
        });

        // Real-time validation for name
        nameInput.addEventListener('input', () => {
            const name = nameInput.value.trim();
            if (name) {
                nameError.style.display = 'none';
                nameInput.style.borderColor = '';
            }
            updateSubmitButton();
        });

        // Real-time validation for base URL
        baseUrlInput.addEventListener('input', () => {
            const url = baseUrlInput.value.trim();
            if (url) {
                vscode.postMessage({
                    command: 'validateUrl',
                    url: url
                });
            } else {
                baseUrlError.textContent = '';
                baseUrlError.style.display = 'none';
                baseUrlSuccess.style.display = 'none';
                baseUrlInput.style.borderColor = '';
                isValidUrl = false;
                updateSubmitButton();
            }
        });

        // Update submit button state
        function updateSubmitButton() {
            const name = nameInput.value.trim();
            const url = baseUrlInput.value.trim();
            
            submitBtn.disabled = !name || !url || !isValidUrl;
        }

        // Handle authentication type change
        authTypeSelect.addEventListener('change', () => {
            const authType = authTypeSelect.value;
            
            // Hide all auth fields
            apikeyFields.classList.remove('show');
            bearerFields.classList.remove('show');
            basicFields.classList.remove('show');
            
            // Show relevant fields
            switch (authType) {
                case 'apikey':
                    apikeyFields.classList.add('show');
                    break;
                case 'bearer':
                    bearerFields.classList.add('show');
                    break;
                case 'basic':
                    basicFields.classList.add('show');
                    break;
            }
        });        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const formData = {
                name: nameInput.value.trim(),
                baseUrl: baseUrlInput.value.trim(),
                description: descriptionInput.value.trim(),
                inheritAuth: inheritAuthToggle.checked,
                auth: {
                    type: inheritAuthToggle.checked ? 'inherit' : authTypeSelect.value
                }
            };
            
            // Only add auth-specific fields if not inheriting from group
            if (!inheritAuthToggle.checked) {
                switch (formData.auth.type) {
                    case 'apikey':
                        formData.auth.keyName = document.getElementById('keyName').value.trim();
                        formData.auth.apiKey = document.getElementById('apiKey').value.trim();
                        break;
                    case 'bearer':
                        formData.auth.token = document.getElementById('bearerToken').value.trim();
                        break;
                    case 'basic':
                        formData.auth.username = document.getElementById('username').value.trim();
                        formData.auth.password = document.getElementById('password').value.trim();
                        break;
                }
            }
            
            // Basic validation
            if (!formData.name) {
                showFieldError('name', 'Environment name is required');
                return;
            }
            
            if (!formData.baseUrl) {
                showFieldError('baseUrl', 'Base URL is required');
                return;
            }
            
            // Validate URL format
            try {
                new URL(formData.baseUrl);
            } catch {
                showFieldError('baseUrl', 'Please enter a valid URL');
                return;
            }
            
            // Validate auth fields
            switch (formData.auth.type) {
                case 'apikey':
                    if (!formData.auth.apiKey) {
                        showFieldError('apiKey', 'API Key is required');
                        return;
                    }
                    break;
                case 'bearer':
                    if (!formData.auth.token) {
                        showFieldError('bearerToken', 'Bearer token is required');
                        return;
                    }
                    break;
                case 'basic':
                    if (!formData.auth.username || !formData.auth.password) {
                        showFieldError('username', 'Username is required');
                        showFieldError('password', 'Password is required');
                        return;
                    }
                    break;
            }
            
            vscode.postMessage({
                command: 'submitForm',
                data: formData
            });
        });

        // Cancel button
        cancelBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'cancel' });
        });

        // Helper functions
        function showFieldError(fieldName, message) {
            const field = document.getElementById(fieldName);
            const errorElement = document.getElementById(fieldName + 'Error');
            
            if (field && errorElement) {
                field.style.borderColor = 'var(--vscode-inputValidation-errorBorder)';
                errorElement.textContent = message;
                errorElement.style.display = 'block';
            }
        }

        function hideFieldError(fieldName) {
            const field = document.getElementById(fieldName);
            const errorElement = document.getElementById(fieldName + 'Error');
            
            if (field && errorElement) {
                field.style.borderColor = '';
                errorElement.style.display = 'none';
            }
        }

        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
            errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        function hideError() {
            errorMessage.style.display = 'none';
        }

        function setLoading(loading) {
            loadingOverlay.style.display = loading ? 'flex' : 'none';
            submitBtn.disabled = loading;
            
            if (loading) {
                submitBtn.textContent = 'Adding Environment...';
            } else {
                submitBtn.textContent = 'Add Environment';
                updateSubmitButton();
            }
        }

        // Handle messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'showError':
                    showError(message.error);
                    break;
                    
                case 'setLoading':
                    setLoading(message.loading);
                    break;
                    
                case 'urlValidation':
                    if (message.valid) {
                        hideFieldError('baseUrl');
                        baseUrlSuccess.style.display = 'block';
                        baseUrlInput.style.borderColor = 'var(--vscode-terminal-ansiGreen)';
                        isValidUrl = true;
                    } else {
                        baseUrlSuccess.style.display = 'none';
                        showFieldError('baseUrl', message.error);
                        isValidUrl = false;
                    }
                    updateSubmitButton();
                    break;
            }
        });

        // Focus on name input when loaded
        nameInput.focus();

        // Initial submit button state
        updateSubmitButton();
    </script>
</body>
</html>`;
    }
}
