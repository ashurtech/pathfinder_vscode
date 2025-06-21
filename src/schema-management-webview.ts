/**
 * Schema Management Webview
 * Provides a UI for configuring schema settings including update URLs and checking for updates
 */

import * as vscode from 'vscode';
import { ApiSchema } from './types';
import { SchemaLoader } from './schema-loader';
import { ConfigurationManager } from './configuration';
import { getPopularIcons, getAllAvailableIcons, getSchemaIcon } from './schema-icon-mapper';
import axios from 'axios';

export class SchemaManagementWebview {
    private panel: vscode.WebviewPanel | undefined;    private readonly schema: ApiSchema;
    private readonly configManager: ConfigurationManager;
    private readonly schemaLoader: SchemaLoader;

    constructor(
        schema: ApiSchema,
        configManager: ConfigurationManager,
        schemaLoader: SchemaLoader
    ) {
        this.schema = schema;
        this.configManager = configManager;
        this.schemaLoader = schemaLoader;
    }

    /**
     * Show the schema management webview
     */
    public show(context: vscode.ExtensionContext) {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'schemaManagement',
            `Manage Schema: ${this.schema.name}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getWebviewContent();        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'saveSchemaUrl':
                        await this.saveSchemaUrl(message.url);
                        break;
                    case 'checkForUpdates':
                        await this.checkForUpdates();
                        break;
                    case 'updateSchema':
                        await this.updateSchema();
                        break;
                    case 'saveIconOverride':
                        await this.saveIconOverride(message.iconSettings);
                        break;
                    case 'getPopularIcons':
                        this.sendPopularIcons();
                        break;
                    case 'searchIcons':
                        this.searchIcons(message.query);
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    /**
     * Save the schema URL for future update checks
     */
    private async saveSchemaUrl(url: string) {
        try {
            this.schema.schema_url = url.trim() || undefined;
            await this.configManager.saveApiSchema(this.schema);
            
            this.panel?.webview.postMessage({
                command: 'urlSaved',
                success: true,
                message: 'Schema URL saved successfully!'
            });

            // Refresh the webview to enable/disable update button
            this.refreshWebview();
              } catch (error: any) {
            this.panel?.webview.postMessage({
                command: 'urlSaved',
                success: false,
                message: `Failed to save URL: ${error?.message ?? 'Unknown error'}`
            });
        }
    }

    /**
     * Check if the remote schema is newer than the current one
     */
    private async checkForUpdates(): Promise<{ hasUpdate: boolean; remoteDate?: Date; error?: string }> {
        if (!this.schema.schema_url) {
            return { hasUpdate: false, error: 'No schema URL configured' };
        }

        try {
            this.panel?.webview.postMessage({
                command: 'updateCheckStarted'
            });

            // Get the remote schema headers to check Last-Modified
            const response = await axios.head(this.schema.schema_url, {
                timeout: 10000
            });

            const lastModified = response.headers['last-modified'];
            const remoteDate = lastModified ? new Date(lastModified) : null;

            // If we can't get a remote date, fetch the schema and compare content
            if (!remoteDate) {
                const contentResponse = await axios.get(this.schema.schema_url, {
                    timeout: 30000,
                    headers: {
                        'Accept': 'application/json, application/yaml, text/yaml'
                    }
                });

                // Simple content comparison - if content is different, consider it updated
                const remoteContent = JSON.stringify(contentResponse.data);
                const currentContent = JSON.stringify(this.schema.schema);
                
                const hasUpdate = remoteContent !== currentContent;
                
                this.panel?.webview.postMessage({
                    command: 'updateCheckComplete',
                    hasUpdate,
                    message: hasUpdate ? 
                        'Schema content has changed (date comparison not available)' :
                        'Schema is up to date'
                });

                return { hasUpdate };
            }

            // Compare dates
            const hasUpdate = remoteDate > this.schema.lastUpdated;
            
            this.panel?.webview.postMessage({
                command: 'updateCheckComplete',
                hasUpdate,
                remoteDate: remoteDate.toISOString(),
                localDate: this.schema.lastUpdated.toISOString(),
                message: hasUpdate ? 
                    `Update available (remote: ${remoteDate.toLocaleString()})` :
                    'Schema is up to date'
            });

            return { hasUpdate, remoteDate };        } catch (error: any) {
            const errorMessage = error?.response ? 
                `HTTP ${error.response.status}: ${error.response.statusText}` :
                error?.message ?? 'Unknown error';

            this.panel?.webview.postMessage({
                command: 'updateCheckComplete',
                hasUpdate: false,
                error: errorMessage
            });

            return { hasUpdate: false, error: errorMessage };
        }
    }

    /**
     * Download and update the schema from the remote URL
     */
    private async updateSchema() {
        if (!this.schema.schema_url) {
            return;
        }

        try {
            this.panel?.webview.postMessage({
                command: 'updateStarted'
            });

            // Create a temporary environment for loading
            const tempEnv = {
                id: 'temp-update',
                name: 'Temporary Update Environment',
                baseUrl: 'https://example.com',
                auth: { type: 'none' as const },
                createdAt: new Date(),
                schemaId: this.schema.id
            };

            // Load the schema from the URL
            const loadedSchema = await this.schemaLoader.loadFromUrl(
                this.schema.schema_url, 
                tempEnv
            );

            if (!loadedSchema.isValid) {
                throw new Error(`Invalid schema: ${loadedSchema.validationErrors?.join(', ')}`);
            }

            // Update the schema
            this.schema.schema = loadedSchema.schema;
            this.schema.lastUpdated = new Date();
            this.schema.isValid = loadedSchema.isValid;
            this.schema.validationErrors = loadedSchema.validationErrors;
            this.schema.platformConfig = loadedSchema.platformConfig;

            // Update version if it changed
            const schemaInfo = this.schemaLoader.getSchemaInfo(loadedSchema.schema);
            this.schema.version = schemaInfo.version;

            // Save the updated schema
            await this.configManager.saveApiSchema(this.schema);

            this.panel?.webview.postMessage({
                command: 'updateComplete',
                success: true,
                message: 'Schema updated successfully!',
                newVersion: schemaInfo.version
            });

            // Refresh any tree views
            vscode.commands.executeCommand('pathfinder.refreshTreeView');        } catch (error: any) {
            this.panel?.webview.postMessage({
                command: 'updateComplete',
                success: false,
                message: `Failed to update schema: ${error?.message ?? 'Unknown error'}`
            });
        }
    }

    /**
     * Save icon override settings for the schema
     */
    private async saveIconOverride(iconSettings: any) {
        try {
            // Initialize iconOverride if it doesn't exist
            if (!this.schema.iconOverride) {
                this.schema.iconOverride = {};
            }

            // Update the icon override settings
            this.schema.iconOverride.useBrandIcon = iconSettings.useBrandIcon;
            this.schema.iconOverride.manualIconName = iconSettings.manualIconName;
            this.schema.iconOverride.fallbackToColorIcon = iconSettings.fallbackToColorIcon;

            // Save the updated schema
            await this.configManager.saveApiSchema(this.schema);
            
            this.panel?.webview.postMessage({
                command: 'iconOverrideSaved',
                success: true,
                message: 'Icon settings saved successfully!'
            });

            // Refresh the tree view to show updated icon
            vscode.commands.executeCommand('pathfinder.refreshTreeView');
            
        } catch (error: any) {
            this.panel?.webview.postMessage({
                command: 'iconOverrideSaved',
                success: false,
                message: `Failed to save icon settings: ${error?.message ?? 'Unknown error'}`
            });
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

    /**
     * Refresh the webview content
     */
    private refreshWebview() {
        if (this.panel) {
            this.panel.webview.html = this.getWebviewContent();
        }
    }

    /**
     * Generate the webview HTML content
     */
    private getWebviewContent(): string {
        const hasUrl = !!this.schema.schema_url;
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Manage Schema: ${this.schema.name}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        
        .section {
            margin-bottom: 30px;
            padding: 20px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            background: var(--vscode-editor-background);
        }
        
        .section h2 {
            margin-top: 0;
            color: var(--vscode-symbolIcon-functionForeground);
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        
        input[type="url"] {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-size: 14px;
        }
        
        .button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 10px;
            margin-bottom: 10px;
        }
        
        .button-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .button-primary:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .button-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .button-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 10px;
            margin-bottom: 15px;
        }
        
        .info-label {
            font-weight: bold;
        }
        
        .status-message {
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
        }
        
        .status-success {
            background: var(--vscode-testing-iconPassed);
            color: var(--vscode-foreground);
        }
        
        .status-error {
            background: var(--vscode-testing-iconFailed);
            color: var(--vscode-foreground);
        }
        
        .status-info {
            background: var(--vscode-testing-iconQueued);
            color: var(--vscode-foreground);
        }
        
        .loading {
            display: none;
        }
        
        .loading.active {
            display: inline-block;
            margin-left: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Manage Schema: ${this.schema.name}</h1>
        
        <!-- Schema Information -->
        <div class="section">
            <h2>📋 Schema Information</h2>
            <div class="info-grid">
                <span class="info-label">Name:</span>
                <span>${this.schema.name}</span>
                
                <span class="info-label">Version:</span>
                <span>${this.schema.version}</span>
                
                <span class="info-label">Source:</span>
                <span>${this.schema.source}</span>
                
                <span class="info-label">Last Updated:</span>
                <span>${this.schema.lastUpdated.toLocaleString()}</span>
                
                <span class="info-label">Valid:</span>
                <span>${this.schema.isValid ? '✅ Yes' : '⚠️ Has warnings'}</span>
            </div>
        </div>
        
        <!-- Update URL Configuration -->
        <div class="section">
            <h2>🔗 Update URL Configuration</h2>
            <p>Configure a URL to check for schema updates. This should point to the OpenAPI specification file.</p>
            
            <div class="form-group">
                <label for="schemaUrl">Schema Update URL:</label>
                <input 
                    type="url" 
                    id="schemaUrl" 
                    placeholder="https://api.example.com/openapi.json"
                    value="${this.schema.schema_url ?? ''}"
                />
            </div>
            
            <button class="button button-primary" onclick="saveUrl()">
                Save URL
            </button>
        </div>
        
        <!-- Update Checking -->
        <div class="section">
            <h2>🔄 Schema Updates</h2>
            <p>Check for updates and download newer versions of your schema.</p>
            
            <div id="statusMessage"></div>
            
            <button 
                class="button button-secondary" 
                id="checkUpdatesBtn"
                onclick="checkForUpdates()"
                ${!hasUrl ? 'disabled' : ''}
            >
                Check for Updates
                <span class="loading" id="checkLoading">⏳</span>
            </button>
              <button 
                class="button button-primary" 
                id="updateBtn"
                onclick="updateSchema()"
                style="display: none;"
            >
                Update Schema
                <span class="loading" id="updateLoading">⏳</span>
            </button>
        </div>
        
        <!-- Icon Management -->
        <div class="section">
            <h2>🎨 Icon Management</h2>
            <p>Customize the brand icon displayed for this schema in the tree view.</p>
            
            <div class="form-group">
                <label>Current Icon Setting:</label>
                <div id="currentIconDisplay">
                    <span id="currentIconPreview"></span>
                    <span id="currentIconDescription">Loading...</span>
                </div>
            </div>
            
            <div class="form-group">
                <label>
                    <input type="radio" name="iconChoice" value="auto" id="iconAuto" checked>
                    Auto-detect brand icon (recommended)
                </label>
            </div>
            
            <div class="form-group">
                <label>
                    <input type="radio" name="iconChoice" value="manual" id="iconManual">
                    Choose a specific icon
                </label>
                <div id="iconSelectionArea" style="display: none; margin-top: 10px;">
                    <div class="form-group">
                        <input type="text" id="iconSearch" placeholder="Search icons..." style="margin-bottom: 10px;">
                    </div>
                    <div id="popularIcons">
                        <h4>Popular Icons:</h4>
                        <div id="popularIconGrid" class="icon-grid"></div>
                    </div>
                    <div id="searchResults" style="display: none;">
                        <h4>Search Results:</h4>
                        <div id="searchResultsGrid" class="icon-grid"></div>
                    </div>
                    <div class="form-group">
                        <label for="selectedIconName">Selected Icon:</label>
                        <input type="text" id="selectedIconName" readonly placeholder="No icon selected">
                    </div>
                </div>
            </div>
            
            <div class="form-group">
                <label>
                    <input type="radio" name="iconChoice" value="none" id="iconNone">
                    No icon (disable brand icon)
                </label>
            </div>
            
            <div class="form-group">
                <label>
                    <input type="checkbox" id="fallbackToColor" checked>
                    Use fallback color icon when brand icon is not available
                </label>
            </div>
            
            <button class="button button-primary" onclick="saveIconSettings()">
                Save Icon Settings
            </button>
        </div>
    </div>

    <style>
        .icon-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            gap: 10px;
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid var(--vscode-panel-border);
            padding: 10px;
            border-radius: 4px;
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
        
        #currentIconDisplay {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            background: var(--vscode-input-background);
        }
        
        #currentIconPreview svg {
            width: 24px;
            height: 24px;
            fill: var(--vscode-foreground);
        }
    </style>

    <script>
        const vscode = acquireVsCodeApi();
        
        // Initialize icon management
        initializeIconManagement();
        
        function saveUrl() {
            const url = document.getElementById('schemaUrl').value;
            vscode.postMessage({
                command: 'saveSchemaUrl',
                url: url
            });
        }
        
        function checkForUpdates() {
            document.getElementById('checkLoading').classList.add('active');
            document.getElementById('checkUpdatesBtn').disabled = true;
            vscode.postMessage({
                command: 'checkForUpdates'
            });
        }
        
        function updateSchema() {
            document.getElementById('updateLoading').classList.add('active');
            document.getElementById('updateBtn').disabled = true;
            vscode.postMessage({
                command: 'updateSchema'
            });
        }
          function showStatus(message, type = 'info') {
            const statusDiv = document.getElementById('statusMessage');
            statusDiv.innerHTML = '<div class="status-message status-' + type + '">' + message + '</div>';
        }
        
        // Icon management functions
        function initializeIconManagement() {
            // Set up current icon settings based on schema
            const iconOverride = ${JSON.stringify(this.schema.iconOverride || {})};
            
            // Set radio buttons based on current settings
            if (iconOverride.useBrandIcon === false) {
                document.getElementById('iconNone').checked = true;
            } else if (iconOverride.manualIconName) {
                document.getElementById('iconManual').checked = true;
                document.getElementById('selectedIconName').value = iconOverride.manualIconName;
                showIconSelection();
            } else {
                document.getElementById('iconAuto').checked = true;
            }
            
            // Set fallback checkbox
            document.getElementById('fallbackToColor').checked = iconOverride.fallbackToColorIcon !== false;
            
            // Update current icon display
            updateCurrentIconDisplay();
            
            // Set up radio button listeners
            document.querySelectorAll('input[name="iconChoice"]').forEach(radio => {
                radio.addEventListener('change', function() {
                    if (this.value === 'manual') {
                        showIconSelection();
                    } else {
                        hideIconSelection();
                    }
                    updateCurrentIconDisplay();
                });
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
        
        function updateCurrentIconDisplay() {
            const iconChoice = document.querySelector('input[name="iconChoice"]:checked').value;
            const preview = document.getElementById('currentIconPreview');
            const description = document.getElementById('currentIconDescription');
            
            if (iconChoice === 'none') {
                preview.innerHTML = '🚫';
                description.textContent = 'No icon (brand icon disabled)';
            } else if (iconChoice === 'manual') {
                const selectedIcon = document.getElementById('selectedIconName').value;
                if (selectedIcon) {
                    preview.innerHTML = '🎯';
                    description.textContent = 'Manual icon: ' + selectedIcon;
                } else {
                    preview.innerHTML = '❓';
                    description.textContent = 'Manual icon: (none selected)';
                }
            } else {
                preview.innerHTML = '🤖';
                description.textContent = 'Auto-detected brand icon';
            }
        }
        
        function selectIcon(slug, svg, title) {
            // Clear previous selections
            document.querySelectorAll('.icon-item').forEach(item => {
                item.classList.remove('selected');
            });
            
            // Mark new selection
            event.target.closest('.icon-item').classList.add('selected');
            
            // Update selected icon
            document.getElementById('selectedIconName').value = slug;
            document.getElementById('iconManual').checked = true;
            
            updateCurrentIconDisplay();
        }
        
        function saveIconSettings() {
            const iconChoice = document.querySelector('input[name="iconChoice"]:checked').value;
            const fallbackToColor = document.getElementById('fallbackToColor').checked;
            
            const iconSettings = {
                fallbackToColorIcon: fallbackToColor
            };
            
            if (iconChoice === 'none') {
                iconSettings.useBrandIcon = false;
                iconSettings.manualIconName = undefined;
            } else if (iconChoice === 'manual') {
                iconSettings.useBrandIcon = true;
                iconSettings.manualIconName = document.getElementById('selectedIconName').value || undefined;
            } else {
                iconSettings.useBrandIcon = true;
                iconSettings.manualIconName = undefined;
            }
            
            vscode.postMessage({
                command: 'saveIconOverride',
                iconSettings: iconSettings
            });
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
        
        // Handle messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'urlSaved':
                    if (message.success) {
                        showStatus(message.message, 'success');
                        document.getElementById('checkUpdatesBtn').disabled = false;
                    } else {
                        showStatus(message.message, 'error');
                    }
                    break;
                    
                case 'iconOverrideSaved':
                    if (message.success) {
                        showStatus(message.message, 'success');
                    } else {
                        showStatus(message.message, 'error');
                    }
                    break;
                    
                case 'popularIconsLoaded':
                    if (message.icons && message.icons.length > 0) {
                        renderIconGrid(message.icons, 'popularIconGrid');
                    } else {
                        document.getElementById('popularIconGrid').innerHTML = '<p>No popular icons available</p>';
                    }
                    break;
                    
                case 'iconSearchResults':
                    if (message.icons && message.icons.length > 0) {
                        renderIconGrid(message.icons, 'searchResultsGrid');
                    } else {
                        document.getElementById('searchResultsGrid').innerHTML = '<p>No icons found for "' + message.query + '"</p>';
                    }
                    break;
                    
                case 'updateCheckStarted':
                    showStatus('Checking for updates...', 'info');
                    break;
                    
                case 'updateCheckComplete':
                    document.getElementById('checkLoading').classList.remove('active');
                    document.getElementById('checkUpdatesBtn').disabled = false;
                    
                    if (message.error) {
                        showStatus('Error checking for updates: ' + message.error, 'error');
                    } else if (message.hasUpdate) {
                        showStatus(message.message, 'info');
                        document.getElementById('updateBtn').style.display = 'inline-block';
                    } else {
                        showStatus(message.message, 'success');
                        document.getElementById('updateBtn').style.display = 'none';
                    }
                    break;
                    
                case 'updateStarted':
                    showStatus('Downloading and updating schema...', 'info');
                    break;
                    
                case 'updateComplete':
                    document.getElementById('updateLoading').classList.remove('active');
                    document.getElementById('updateBtn').disabled = false;
                    
                    if (message.success) {
                        showStatus(message.message, 'success');
                        document.getElementById('updateBtn').style.display = 'none';
                        // Refresh the page to show new version info
                        setTimeout(() => location.reload(), 2000);
                    } else {
                        showStatus(message.message, 'error');
                    }
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}
