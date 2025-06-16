import * as vscode from 'vscode';
import { ConfigurationManager } from '../configuration';

export class AddEnvironmentGroupWebview {
    private panel: vscode.WebviewPanel | undefined;    constructor(
        private readonly configManager: ConfigurationManager,
        private readonly onGroupAdded: () => void
    ) {}

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

            // Create the environment group object
            const group = {
                id: `group_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                name: data.name.trim(),
                description: data.description?.trim(),
                color: data.color ?? 'blue',
                createdAt: new Date()
            };

            // Save the environment group
            await this.configManager.saveEnvironmentGroup(group);

            // Show success message
            vscode.window.showInformationMessage(`Environment group "${group.name}" created successfully!`);

            // Close the webview and refresh
            this.panel?.dispose();
            this.onGroupAdded();

        } catch (error) {
            // Show error state
            await this.panel?.webview.postMessage({
                command: 'setLoading',
                loading: false
            });

            await this.panel?.webview.postMessage({
                command: 'showError',
                error: `Failed to create environment group: ${error}`
            });
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
}
