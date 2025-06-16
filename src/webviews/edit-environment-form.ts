import * as vscode from 'vscode';
import { ConfigurationManager } from '../configuration';
import { ApiEnvironment } from '../types';

export class EditEnvironmentWebview {
    private panel: vscode.WebviewPanel | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly configManager: ConfigurationManager,
        private readonly environment: ApiEnvironment,
        private readonly onEnvironmentUpdated: () => void
    ) {}

    async show() {
        // Create and show a new webview panel
        this.panel = vscode.window.createWebviewPanel(
            'editEnvironment',
            `Edit Environment: ${this.environment.name}`,
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
                return;
            }

            // Create the updated environment object
            const updatedEnvironment: ApiEnvironment = {
                ...this.environment,
                name: data.name.trim(),
                baseUrl: data.baseUrl.trim(),
                description: data.description?.trim() || undefined
            };

            // Save the environment
            await this.configManager.saveApiEnvironment(updatedEnvironment);

            // Show success message
            vscode.window.showInformationMessage(`Environment "${updatedEnvironment.name}" updated successfully!`);

            // Call the callback to refresh the tree
            this.onEnvironmentUpdated();

            // Close the panel
            this.panel?.dispose();

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await this.panel?.webview.postMessage({
                command: 'showError',
                error: `Failed to update environment: ${errorMessage}`
            });
            vscode.window.showErrorMessage(`Failed to update environment: ${errorMessage}`);
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
        // Escape values for HTML
        const escapedName = this.escapeHtml(this.environment.name || '');
        const escapedBaseUrl = this.escapeHtml(this.environment.baseUrl || '');
        const escapedDescription = this.escapeHtml(this.environment.description || '');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Edit Environment</title>
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

        .environment-info {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            padding: 12px 16px;
            margin-bottom: 24px;
            border-radius: 4px;
        }

        .environment-info h3 {
            margin: 0 0 8px 0;
            color: var(--vscode-textPreformat-foreground);
            font-size: 14px;
            font-weight: 600;
        }

        .environment-info p {
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
        }

        .help-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }

        .changed-indicator {
            color: var(--vscode-gitDecoration-modifiedResourceForeground);
            font-size: 12px;
            margin-left: 8px;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Edit Environment</h1>
        
        <div class="environment-info">
            <h3>Editing Environment</h3>
            <p><strong>ID:</strong> ${this.environment.id}</p>
            <p><strong>Current Name:</strong> ${escapedName}</p>
            <p>Make changes to this environment's configuration below.</p>
        </div>

        <div class="error-message" id="errorMessage"></div>

        <form id="environmentForm">
            <div class="form-group">
                <label for="name">Environment Name <span class="required">*</span></label>
                <input type="text" id="name" name="name" value="${escapedName}" required />
                <div class="validation-error" id="nameError"></div>
                <div class="help-text">A descriptive name for this environment</div>
                <div class="changed-indicator" id="nameChanged" style="display: none;">Modified</div>
            </div>

            <div class="form-group">
                <label for="baseUrl">Base URL <span class="required">*</span></label>
                <input type="url" id="baseUrl" name="baseUrl" value="${escapedBaseUrl}" required />
                <div class="validation-error" id="baseUrlError"></div>
                <div class="validation-success" id="baseUrlSuccess">✓ Valid URL format</div>
                <div class="help-text">The base URL for API requests in this environment</div>
                <div class="changed-indicator" id="baseUrlChanged" style="display: none;">Modified</div>
            </div>

            <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" placeholder="Optional description for this environment...">${escapedDescription}</textarea>
                <div class="help-text">Optional description to help identify this environment</div>
                <div class="changed-indicator" id="descriptionChanged" style="display: none;">Modified</div>
            </div>

            <div class="button-group">
                <button type="submit" class="btn-primary" id="submitBtn">
                    Update Environment
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
        const vscode = acquireVsCodeApi();

        // Form elements
        const form = document.getElementById('environmentForm');
        const nameInput = document.getElementById('name');
        const baseUrlInput = document.getElementById('baseUrl');
        const descriptionInput = document.getElementById('description');
        const submitBtn = document.getElementById('submitBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const errorMessage = document.getElementById('errorMessage');
        const loadingOverlay = document.getElementById('loadingOverlay');

        // Validation elements
        const nameError = document.getElementById('nameError');
        const baseUrlError = document.getElementById('baseUrlError');
        const baseUrlSuccess = document.getElementById('baseUrlSuccess');

        // Change indicators
        const nameChanged = document.getElementById('nameChanged');
        const baseUrlChanged = document.getElementById('baseUrlChanged');
        const descriptionChanged = document.getElementById('descriptionChanged');

        // Store original values for change detection
        const originalValues = {
            name: nameInput.value,
            baseUrl: baseUrlInput.value,
            description: descriptionInput.value
        };

        // Form validation
        let isValidUrl = true; // Start as true since we have an existing valid URL

        // Change detection helper
        function checkForChanges() {
            const nameHasChanged = nameInput.value !== originalValues.name;
            const baseUrlHasChanged = baseUrlInput.value !== originalValues.baseUrl;
            const descriptionHasChanged = descriptionInput.value !== originalValues.description;

            nameChanged.style.display = nameHasChanged ? 'block' : 'none';
            baseUrlChanged.style.display = baseUrlHasChanged ? 'block' : 'none';
            descriptionChanged.style.display = descriptionHasChanged ? 'block' : 'none';

            const hasAnyChanges = nameHasChanged || baseUrlHasChanged || descriptionHasChanged;
            updateSubmitButton(hasAnyChanges);
        }

        // Real-time validation for name
        nameInput.addEventListener('input', () => {
            const name = nameInput.value.trim();
            if (name) {
                nameError.style.display = 'none';
                nameInput.style.borderColor = '';
            }
            checkForChanges();
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
                checkForChanges();
            }
        });

        // Monitor description changes
        descriptionInput.addEventListener('input', checkForChanges);

        // Update submit button state
        function updateSubmitButton(hasChanges = false) {
            const name = nameInput.value.trim();
            const url = baseUrlInput.value.trim();
            
            const isValid = name && url && isValidUrl;
            submitBtn.disabled = !isValid || !hasChanges;
            
            if (!hasChanges && isValid) {
                submitBtn.title = 'No changes to save';
            } else if (!isValid) {
                submitBtn.title = 'Please fix validation errors';
            } else {
                submitBtn.title = '';
            }
        }

        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const formData = {
                name: nameInput.value.trim(),
                baseUrl: baseUrlInput.value.trim(),
                description: descriptionInput.value.trim()
            };

            // Basic validation
            if (!formData.name) {
                showFieldError('name', 'Environment name is required');
                return;
            }

            if (!formData.baseUrl) {
                showFieldError('baseUrl', 'Base URL is required');
                return;
            }

            if (!isValidUrl) {
                showFieldError('baseUrl', 'Please enter a valid URL');
                return;
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
                submitBtn.textContent = 'Updating Environment...';
            } else {
                submitBtn.textContent = 'Update Environment';
                checkForChanges();
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
                    checkForChanges();
                    break;
            }
        });

        // Initial validation for existing URL
        if (baseUrlInput.value) {
            baseUrlSuccess.style.display = 'block';
        }

        // Focus on name input when loaded
        nameInput.focus();
        nameInput.select(); // Select text for easy editing

        // Initial submit button state
        checkForChanges();
    </script>
</body>
</html>`;
    }    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}
