/**
 * Webview form for adding a new API schema
 * This replaces the multiple input dialogs with a single comprehensive form
 */

import * as vscode from 'vscode';
import { ConfigurationManager } from '../configuration';
import { SchemaLoader } from '../schema-loader';
import { ApiSchema } from '../types';
import { getPopularIcons, getAllAvailableIcons } from '../schema-icon-mapper';

export class AddSchemaWebview {
    private panel: vscode.WebviewPanel | undefined;
    
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly configManager: ConfigurationManager,
        private readonly schemaLoader: SchemaLoader,
        private readonly onSchemaAdded: () => void
    ) {}

    public async show() {
        // Create and show webview panel
        this.panel = vscode.window.createWebviewPanel(
            'addSchemaForm',
            'Add API Schema',
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
    }    private async handleMessage(message: any) {
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
            case 'browseFile':
                await this.handleFileBrowser();
                break;
            case 'getPopularIcons':
                this.sendPopularIcons();
                break;
            case 'searchIcons':
                this.searchIcons(message.query);
                break;
        }
    }

    private async handleFormSubmission(data: any) {
        try {
            // Show loading state
            await this.panel?.webview.postMessage({
                command: 'setLoading',
                loading: true,
                message: 'Loading schema...'
            });

            // Validate form data
            if (!data.name?.trim()) {
                throw new Error('Schema name is required');
            }

            if (!data.source?.trim()) {
                throw new Error('Schema source (URL or file path) is required');
            }            // Load and parse schema using SchemaLoader public API
            let loadedSchema;
            let source = data.source.trim();
            
            if (data.sourceType === 'url') {
                // Validate URL
                try {
                    new URL(source);
                } catch {
                    throw new Error('Invalid URL format');
                }

                // Create temporary environment for loading
                const tempEnv = {
                    id: 'temp',
                    name: 'temp',
                    baseUrl: source,
                    auth: { type: 'none' as const },
                    createdAt: new Date()
                };

                loadedSchema = await this.schemaLoader.loadFromUrl(source, tempEnv);
            } else {
                // Create temporary environment for file loading
                const tempEnv = {
                    id: 'temp',
                    name: 'temp',
                    baseUrl: '',
                    auth: { type: 'none' as const },
                    createdAt: new Date()
                };

                loadedSchema = await this.schemaLoader.loadFromFile(source, tempEnv);
            }
            
            if (!loadedSchema.schema) {
                throw new Error('Failed to load OpenAPI schema');
            }

            // Extract schema info
            const info = this.schemaLoader.getSchemaInfo(loadedSchema.schema);            // Create the ApiSchema object
            const newSchema: ApiSchema = {
                id: `schema_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                name: data.name.trim(),
                description: data.description?.trim() ?? info.description,
                schema: loadedSchema.schema,
                source: source,
                schema_url: data.sourceType === 'url' ? source : undefined,
                loadedAt: new Date(),
                lastUpdated: new Date(),
                isValid: loadedSchema.isValid,
                validationErrors: loadedSchema.validationErrors ?? [],
                platformConfig: loadedSchema.platformConfig,
                version: info.version ?? '1.0.0',
                baseConfig: {
                    defaultHeaders: {},
                    defaultAuthType: 'none',
                    defaultTimeout: 30000
                },
                color: data.color ?? 'blue',
                iconOverride: data.iconSettings ? {
                    useBrandIcon: data.iconSettings.useBrandIcon,
                    manualIconName: data.iconSettings.manualIconName,
                    fallbackToColorIcon: data.iconSettings.fallbackToColorIcon
                } : undefined
            };

            // Save the schema
            await this.configManager.saveApiSchema(newSchema);

            // Notify success
            await this.panel?.webview.postMessage({
                command: 'setLoading',
                loading: false
            });            // Show success message with validation
            if (info.endpointCount === 0) {
                // Zero endpoints should be treated as an error
                throw new Error(`Schema loaded but contains no endpoints. This usually indicates an invalid or incomplete OpenAPI specification.`);
            }
            
            const validationInfo = loadedSchema.isValid 
                ? `✅ Schema loaded successfully!`
                : `⚠️ Schema loaded with ${loadedSchema.validationErrors?.length ?? 0} validation warnings`;

            vscode.window.showInformationMessage(
                `${validationInfo}\nAPI: ${info.title} v${info.version}\nEndpoints: ${info.endpointCount}`
            );

            // Close the webview and refresh
            this.panel?.dispose();
            this.onSchemaAdded();

        } catch (error) {
            // Show error state
            await this.panel?.webview.postMessage({
                command: 'setLoading',
                loading: false
            });

            await this.panel?.webview.postMessage({
                command: 'showError',
                error: `Failed to add schema: ${error}`
            });
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

    private async handleFileBrowser() {
        try {
            const fileUri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'OpenAPI Schema': ['json', 'yaml', 'yml']
                },
                title: 'Select OpenAPI Schema File'
            });

            if (fileUri?.[0]) {
                await this.panel?.webview.postMessage({
                    command: 'setFilePath',
                    path: fileUri[0].fsPath
                });
            }
        } catch (error) {
            console.error('File browser error:', error);
        }
    }

    /**
     * Send popular icons to the webview
     */
    private sendPopularIcons() {
        try {
            const popularIcons = getPopularIcons();
            this.panel?.webview.postMessage({
                command: 'popularIconsLoaded',
                icons: popularIcons
            });
        } catch (error: any) {
            this.panel?.webview.postMessage({
                command: 'popularIconsLoaded',
                icons: [],
                error: error?.message ?? 'Failed to load popular icons'
            });
        }
    }

    /**
     * Search for icons matching the query
     */
    private searchIcons(query: string) {
        try {
            const allIcons = getAllAvailableIcons();
            const filteredIcons = allIcons.filter(icon => 
                icon.title.toLowerCase().includes(query.toLowerCase()) ||
                icon.slug.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 50); // Limit results

            this.panel?.webview.postMessage({
                command: 'iconSearchResults',
                icons: filteredIcons,
                query: query
            });
        } catch (error: any) {
            this.panel?.webview.postMessage({
                command: 'iconSearchResults',
                icons: [],
                query: query,
                error: error?.message ?? 'Failed to search icons'
            });
        }
    }

    private getWebviewContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Add API Schema</title>
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
        
        input, textarea, select {
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
        
        input:focus, textarea:focus, select:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        textarea {
            min-height: 80px;
            resize: vertical;
        }
        
        .source-type-group {
            display: flex;
            gap: 10px;
            margin-bottom: 10px;
        }
        
        .source-type-option {
            flex: 1;
            padding: 10px;
            border: 2px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 6px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .source-type-option:hover {
            border-color: var(--vscode-focusBorder);
        }
        
        .source-type-option.selected {
            border-color: var(--vscode-button-background);
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .source-input-group {
            display: flex;
            gap: 8px;
            align-items: flex-end;
        }
        
        .source-input-group input {
            flex: 1;
        }
        
        .browse-button {
            padding: 8px 16px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            white-space: nowrap;
        }
        
        .browse-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
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
        
        .icon-choice-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 8px;
        }
        
        .icon-choice-option {
            display: flex;
            align-items: flex-start;
            padding: 12px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
            background-color: var(--vscode-input-background);
        }
        
        .icon-choice-option:hover {
            border-color: var(--vscode-focusBorder);
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .icon-choice-option input[type="radio"] {
            margin-right: 10px;
            margin-top: 2px;
        }
        
        .icon-choice-option span {
            font-weight: 500;
            display: block;
            margin-bottom: 4px;
        }
        
        .icon-choice-hint {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-left: 20px;
        }
        
        .icon-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            gap: 10px;
            max-height: 250px;
            overflow-y: auto;
            border: 1px solid var(--vscode-panel-border);
            padding: 10px;
            border-radius: 4px;
            background-color: var(--vscode-input-background);
        }
        
        .icon-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 8px;
            border: 1px solid transparent;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .icon-item:hover {
            background: var(--vscode-list-hoverBackground);
            border-color: var(--vscode-focusBorder);
        }
        
        .icon-item.selected {
            background: var(--vscode-list-activeSelectionBackground);
            border-color: var(--vscode-focusBorder);
        }
        
        .icon-item svg {
            width: 24px;
            height: 24px;
            fill: var(--vscode-foreground);
        }
        
        .icon-item .icon-title {
            font-size: 10px;
            text-align: center;
            margin-top: 4px;
            word-break: break-word;
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
        
        .validation-message {
            font-size: 12px;
            margin-top: 4px;
            color: var(--vscode-inputValidation-errorForeground);
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
    </style>
</head>
<body>
    <div class="container">
        <h1>Add API Schema</h1>
        
        <div class="error" id="errorMessage"></div>
        
        <form id="schemaForm">
            <div class="form-group">
                <label for="name">Schema Name *</label>
                <input type="text" id="name" name="name" placeholder="e.g., Kibana API v8.0" required>
                <div class="hint">A descriptive name for this API schema</div>
            </div>
            
            <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" placeholder="e.g., Kibana management API for production environment"></textarea>
                <div class="hint">Optional description that will be shown in the tree view</div>
            </div>
            
            <div class="form-group">
                <label>Schema Source *</label>
                <div class="source-type-group">
                    <div class="source-type-option selected" data-type="url">
                        🌐 Load from URL
                    </div>
                    <div class="source-type-option" data-type="file">
                        📁 Load from File
                    </div>
                </div>
                
                <div class="source-input-group">
                    <input type="text" id="source" name="source" placeholder="https://api.example.com/openapi.json" required>
                    <button type="button" class="browse-button" id="browseButton" style="display: none;">Browse...</button>
                </div>
                <div class="validation-message" id="sourceValidation" style="display: none;"></div>
                <div class="hint" id="sourceHint">Enter the URL where your OpenAPI schema is hosted</div>
            </div>
            
            <div class="form-group">
                <label>Color Theme</label>                <div class="color-group">
                    <div class="color-option color-blue selected" data-color="blue" title="Blue" role="button" aria-label="Select blue color theme" tabindex="0"></div>
                    <div class="color-option color-green" data-color="green" title="Green" role="button" aria-label="Select green color theme" tabindex="0"></div>
                    <div class="color-option color-orange" data-color="orange" title="Orange" role="button" aria-label="Select orange color theme" tabindex="0"></div>
                    <div class="color-option color-purple" data-color="purple" title="Purple" role="button" aria-label="Select purple color theme" tabindex="0"></div>
                    <div class="color-option color-red" data-color="red" title="Red" role="button" aria-label="Select red color theme" tabindex="0"></div>
                    <div class="color-option color-yellow" data-color="yellow" title="Yellow" role="button" aria-label="Select yellow color theme" tabindex="0"></div>                </div>
                <div class="hint">Choose a color for visual identification in the tree view</div>
            </div>
            
            <div class="form-group">
                <label>Brand Icon</label>
                <div class="icon-choice-group">
                    <label class="icon-choice-option">
                        <input type="radio" name="iconChoice" value="auto" checked>
                        <span>🤖 Auto-detect brand icon</span>
                        <div class="icon-choice-hint">Automatically find the best icon based on schema content</div>
                    </label>
                    
                    <label class="icon-choice-option">
                        <input type="radio" name="iconChoice" value="manual">
                        <span>🎯 Choose specific icon</span>
                        <div class="icon-choice-hint">Select from thousands of brand icons</div>
                    </label>
                    
                    <label class="icon-choice-option">
                        <input type="radio" name="iconChoice" value="none">
                        <span>🚫 No brand icon</span>
                        <div class="icon-choice-hint">Use only color-coded icons</div>
                    </label>
                </div>
                
                <div id="iconSelectionArea" style="display: none; margin-top: 15px;">
                    <div class="form-group">
                        <input type="text" id="iconSearch" placeholder="Search icons..." style="margin-bottom: 10px;">
                    </div>
                    <div id="popularIcons">
                        <h4 style="margin: 10px 0;">Popular Icons:</h4>
                        <div id="popularIconGrid" class="icon-grid"></div>
                    </div>
                    <div id="searchResults" style="display: none;">
                        <h4 style="margin: 10px 0;">Search Results:</h4>
                        <div id="searchResultsGrid" class="icon-grid"></div>
                    </div>
                    <div class="form-group" style="margin-top: 15px;">
                        <label for="selectedIconName">Selected Icon:</label>
                        <input type="text" id="selectedIconName" readonly placeholder="No icon selected">
                    </div>
                </div>
                
                <div class="form-group" style="margin-top: 10px;">
                    <label>
                        <input type="checkbox" id="fallbackToColor" checked>
                        <span>Use fallback color icon when brand icon is not available</span>
                    </label>
                </div>
                
                <div class="hint">Brand icons help visually identify different APIs and services</div>
            </div>
        </form>
        
        <div class="loading" id="loadingMessage">
            <div>⏳ Loading schema...</div>
        </div>
        
        <div class="buttons">
            <button type="button" class="button button-secondary" id="cancelButton">Cancel</button>
            <button type="submit" class="button button-primary" id="submitButton" form="schemaForm">Add Schema</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        // Form elements
        const form = document.getElementById('schemaForm');
        const nameInput = document.getElementById('name');
        const descriptionInput = document.getElementById('description');
        const sourceInput = document.getElementById('source');
        const browseButton = document.getElementById('browseButton');
        const sourceValidation = document.getElementById('sourceValidation');
        const sourceHint = document.getElementById('sourceHint');
        const errorMessage = document.getElementById('errorMessage');
        const loadingMessage = document.getElementById('loadingMessage');
        const submitButton = document.getElementById('submitButton');
        const cancelButton = document.getElementById('cancelButton');
          // State
        let selectedSourceType = 'url';
        let selectedColor = 'blue';
        let selectedIconChoice = 'auto';
        let selectedIconName = '';
        let fallbackToColor = true;
        
        // Initialize icon management
        initializeIconManagement();
        
        // Source type selection
        document.querySelectorAll('.source-type-option').forEach(option => {
            option.addEventListener('click', () => {
                // Update selection
                document.querySelectorAll('.source-type-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
                
                selectedSourceType = option.dataset.type;
                updateSourceInput();
            });
        });
        
        function updateSourceInput() {
            if (selectedSourceType === 'url') {
                sourceInput.placeholder = 'https://api.example.com/openapi.json';
                sourceHint.textContent = 'Enter the URL where your OpenAPI schema is hosted';
                browseButton.style.display = 'none';
            } else {
                sourceInput.placeholder = 'C:\\path\\to\\schema.json';
                sourceHint.textContent = 'Enter the file path or click Browse to select a file';
                browseButton.style.display = 'block';
            }
            clearValidation();
        }
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
        
        // URL validation (debounced)
        let validationTimeout;
        sourceInput.addEventListener('input', () => {
            clearTimeout(validationTimeout);
            if (selectedSourceType === 'url' && sourceInput.value.trim()) {
                validationTimeout = setTimeout(() => {
                    vscode.postMessage({
                        command: 'validateUrl',
                        url: sourceInput.value.trim()
                    });
                }, 500);
            } else {
                clearValidation();
            }
        });
        
        function clearValidation() {
            sourceValidation.style.display = 'none';
            sourceValidation.textContent = '';
        }
        
        // Browse button
        browseButton.addEventListener('click', () => {
            vscode.postMessage({ command: 'browseFile' });
        });
        
        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
              const formData = {
                name: nameInput.value.trim(),
                description: descriptionInput.value.trim(),
                source: sourceInput.value.trim(),
                sourceType: selectedSourceType,
                color: selectedColor,
                iconSettings: selectedIconChoice !== 'auto' ? {
                    useBrandIcon: selectedIconChoice !== 'none',
                    manualIconName: selectedIconChoice === 'manual' ? selectedIconName : undefined,
                    fallbackToColorIcon: fallbackToColor
                } : undefined
            };
            
            // Basic validation
            if (!formData.name) {
                showError('Schema name is required');
                return;
            }
            
            if (!formData.source) {
                showError('Schema source is required');
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
                case 'urlValidationResult':
                    handleUrlValidation(message);
                    break;
                case 'setFilePath':
                    sourceInput.value = message.path;
                    clearValidation();
                    break;
                case 'popularIconsLoaded':
                    if (message.icons && message.icons.length > 0) {
                        renderIconGrid(message.icons, 'popularIconGrid');
                    } else {
                        document.getElementById('popularIconGrid').innerHTML = '<p style="text-align: center; color: var(--vscode-descriptionForeground);">No popular icons available</p>';
                    }
                    break;
                case 'iconSearchResults':
                    if (message.icons && message.icons.length > 0) {
                        renderIconGrid(message.icons, 'searchResultsGrid');
                    } else {
                        document.getElementById('searchResultsGrid').innerHTML = '<p style="text-align: center; color: var(--vscode-descriptionForeground);">No icons found for "' + message.query + '"</p>';
                    }
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
        
        function handleUrlValidation(result) {
            if (result.valid) {
                sourceValidation.style.display = 'none';
            } else {
                sourceValidation.textContent = result.error || 'Invalid URL';
                sourceValidation.style.display = 'block';
            }
        }
        
        // Icon management functions
        function initializeIconManagement() {
            // Set up icon choice listeners
            document.querySelectorAll('input[name="iconChoice"]').forEach(radio => {
                radio.addEventListener('change', function() {
                    selectedIconChoice = this.value;
                    if (this.value === 'manual') {
                        showIconSelection();
                    } else {
                        hideIconSelection();
                    }
                });
            });
            
            // Set up fallback checkbox
            const fallbackCheckbox = document.getElementById('fallbackToColor');
            fallbackCheckbox.addEventListener('change', function() {
                fallbackToColor = this.checked;
            });
            
            // Set up search functionality
            const searchInput = document.getElementById('iconSearch');
            let searchTimeout;
            searchInput.addEventListener('input', function() {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    if (this.value.trim()) {
                        vscode.postMessage({
                            command: 'searchIcons',
                            query: this.value.trim()
                        });
                        document.getElementById('searchResults').style.display = 'block';
                    } else {
                        document.getElementById('searchResults').style.display = 'none';
                    }
                }, 300);
            });
            
            // Load popular icons initially
            vscode.postMessage({ command: 'getPopularIcons' });
        }
        
        function showIconSelection() {
            document.getElementById('iconSelectionArea').style.display = 'block';
        }
        
        function hideIconSelection() {
            document.getElementById('iconSelectionArea').style.display = 'none';
        }
        
        function selectIcon(slug, svg, title) {
            // Clear previous selections
            document.querySelectorAll('.icon-item').forEach(item => {
                item.classList.remove('selected');
            });
            
            // Mark new selection
            event.target.closest('.icon-item').classList.add('selected');
            
            // Update selected icon
            selectedIconName = slug;
            document.getElementById('selectedIconName').value = slug;
            document.querySelector('input[name="iconChoice"][value="manual"]').checked = true;
            selectedIconChoice = 'manual';
        }
        
        function renderIconGrid(icons, containerId) {
            const container = document.getElementById(containerId);
            container.innerHTML = '';
            
            icons.forEach(icon => {
                const iconItem = document.createElement('div');
                iconItem.className = 'icon-item';
                iconItem.onclick = () => selectIcon(icon.slug, icon.svg, icon.title);
                
                iconItem.innerHTML = \`
                    <div>\${icon.svg}</div>
                    <div class="icon-title">\${icon.title}</div>
                \`;
                
                container.appendChild(iconItem);
            });
        }

        // Focus first input
        nameInput.focus();
    </script>
</body>
</html>`;
    }
}
