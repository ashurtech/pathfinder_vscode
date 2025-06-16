import * as vscode from 'vscode';
import { ConfigurationManager } from '../configuration';
import { SchemaEnvironment, SchemaEnvironmentGroup } from '../types';

export class CredentialForm {
    private panel: vscode.WebviewPanel | undefined;
    private readonly configManager: ConfigurationManager;
    private readonly target: SchemaEnvironment | SchemaEnvironmentGroup;
    private readonly onCredentialsSet: () => void;

    constructor(
        context: vscode.ExtensionContext,
        configManager: ConfigurationManager,
        target: SchemaEnvironment | SchemaEnvironmentGroup,
        onCredentialsSet: () => void
    ) {
        this.configManager = configManager;
        this.target = target;
        this.onCredentialsSet = onCredentialsSet;
    }

    async show() {
        // Create and show panel
        this.panel = vscode.window.createWebviewPanel(
            'credentialForm',
            `Set Credentials - ${this.target.name}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Set the webview's initial html content
        this.panel.webview.html = this.getHtmlForWebview();

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'submitForm':
                        await this.handleSubmit(message.data);
                        break;
                    case 'cancel':
                        this.dispose();
                        break;
                }
            },
            null,
            []
        );

        // Handle panel disposal
        this.panel.onDidDispose(
            () => {
                this.panel = undefined;
            },
            null,
            []
        );
    }

    private dispose() {
        this.panel?.dispose();
    }

    private async handleSubmit(data: any) {
        try {
            // Validate required fields based on auth type
            if (data.auth.type === 'basic' && (!data.auth.username || !data.auth.password)) {
                vscode.window.showErrorMessage('Username and password are required for basic authentication');
                return;
            }
            if (data.auth.type === 'apikey' && !data.auth.apiKey) {
                vscode.window.showErrorMessage('API key is required');
                return;
            }

            // Prepare credentials object
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
            const secretKey = await this.configManager.setCredentials(this.target, credentials);

            // Update the target with the new secret key
            const updatedTarget = {
                ...this.target,
                authSecretKey: secretKey
            };

            // Save the updated target
            if ('schemaId' in this.target) {
                await this.configManager.saveSchemaEnvironment(updatedTarget as SchemaEnvironment);
            } else {
                await this.configManager.saveSchemaEnvironmentGroup(updatedTarget as SchemaEnvironmentGroup);
            }

            // Close the webview
            this.dispose();

            // Notify that credentials were set
            this.onCredentialsSet();

            vscode.window.showInformationMessage(`Credentials for "${this.target.name}" set successfully!`);

        } catch (error) {
            console.error('Failed to set credentials:', error);
            vscode.window.showErrorMessage(`Failed to set credentials: ${error}`);
        }
    }

    private getHtmlForWebview() {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Set Credentials</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                        color: var(--vscode-foreground);
                    }
                    .form-group {
                        margin-bottom: 15px;
                    }
                    label {
                        display: block;
                        margin-bottom: 5px;
                        font-weight: bold;
                    }
                    input[type="text"],
                    input[type="password"] {
                        width: 100%;
                        padding: 8px;
                        border: 1px solid var(--vscode-input-border);
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border-radius: 2px;
                    }
                    select {
                        width: 100%;
                        padding: 8px;
                        border: 1px solid var(--vscode-input-border);
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border-radius: 2px;
                    }
                    .auth-fields {
                        display: none;
                        margin-top: 10px;
                        padding: 10px;
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 2px;
                    }
                    .auth-fields.active {
                        display: block;
                    }
                    .button-group {
                        margin-top: 20px;
                        display: flex;
                        gap: 10px;
                        justify-content: flex-end;
                    }
                    button {
                        padding: 8px 16px;
                        border: none;
                        border-radius: 2px;
                        cursor: pointer;
                    }
                    button.primary {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                    }
                    button.secondary {
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }
                    button:hover {
                        opacity: 0.9;
                    }
                </style>
            </head>
            <body>
                <h2>Set Credentials for ${this.target.name}</h2>
                <form id="credentialForm">
                    <div class="form-group">
                        <label for="authType">Authentication Type</label>
                        <select id="authType" name="auth.type" required>
                            <option value="none">No Authentication</option>
                            <option value="basic">Basic Authentication</option>
                            <option value="apikey">API Key</option>
                        </select>
                    </div>

                    <div id="basicAuthFields" class="auth-fields">
                        <div class="form-group">
                            <label for="username">Username</label>
                            <input type="text" id="username" name="auth.username" required>
                        </div>
                        <div class="form-group">
                            <label for="password">Password</label>
                            <input type="password" id="password" name="auth.password" required>
                        </div>
                    </div>

                    <div id="apiKeyFields" class="auth-fields">
                        <div class="form-group">
                            <label for="apiKey">API Key</label>
                            <input type="password" id="apiKey" name="auth.apiKey" required>
                        </div>
                    </div>

                    <div class="button-group">
                        <button type="button" class="secondary" onclick="cancel()">Cancel</button>
                        <button type="submit" class="primary">Save Credentials</button>
                    </div>
                </form>

                <script>
                    const vscode = acquireVsCodeApi();
                    const form = document.getElementById('credentialForm');
                    const authType = document.getElementById('authType');
                    const basicAuthFields = document.getElementById('basicAuthFields');
                    const apiKeyFields = document.getElementById('apiKeyFields');

                    // Show/hide auth fields based on selected type
                    authType.addEventListener('change', () => {
                        basicAuthFields.classList.remove('active');
                        apiKeyFields.classList.remove('active');
                        
                        if (authType.value === 'basic') {
                            basicAuthFields.classList.add('active');
                        } else if (authType.value === 'apikey') {
                            apiKeyFields.classList.add('active');
                        }
                    });

                    // Handle form submission
                    form.addEventListener('submit', (e) => {
                        e.preventDefault();
                        
                        const formData = new FormData(form);
                        const data = {
                            auth: {
                                type: formData.get('auth.type')
                            }
                        };

                        if (data.auth.type === 'basic') {
                            data.auth.username = formData.get('auth.username');
                            data.auth.password = formData.get('auth.password');
                        } else if (data.auth.type === 'apikey') {
                            data.auth.apiKey = formData.get('auth.apiKey');
                        }

                        vscode.postMessage({
                            command: 'submitForm',
                            data: data
                        });
                    });

                    // Handle cancel
                    function cancel() {
                        vscode.postMessage({
                            command: 'cancel'
                        });
                    }
                </script>
            </body>
            </html>
        `;
    }
} 