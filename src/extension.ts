/**
 * Main Extension Entry Point
 * 
 * This is where VS Code loads our extension. The activate() function is called
 * when the extension starts up, and we register all our commands here.
 * 
 * Think of this as the "main()" function for our extension.
 */

import * as vscode from 'vscode';
import { ConfigurationManager } from './configuration';
import { SchemaLoader } from './schema-loader';
import { ApiTreeProvider } from './tree-provider';
import { showEnvironmentDetailsCommand, showSchemaDetailsCommand, showEndpointDetailsCommand, generateCodeForEndpointCommand, testEndpointCommand } from './tree-commands';
import { ApiEnvironment } from './types';

// Global instances that will be used throughout the extension
let configManager: ConfigurationManager;
let schemaLoader: SchemaLoader;
let treeProvider: ApiTreeProvider;

/**
 * This method is called when your extension is activated
 * VS Code calls this when the extension is first needed
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('🚀 API Helper Extension is starting up!');
    
    // Initialize our core services
    configManager = new ConfigurationManager(context);
    schemaLoader = new SchemaLoader();
    treeProvider = new ApiTreeProvider(configManager, schemaLoader);
    
    // Register the tree view
    const treeView = vscode.window.createTreeView('apiHelperExplorer', {
        treeDataProvider: treeProvider,
        showCollapseAll: true
    });
    
    // Register all our commands
    registerCommands(context);
    
    // Register tree view commands
    registerTreeCommands(context);
    
    // Add tree view to subscriptions
    context.subscriptions.push(treeView);
    
    console.log('✅ API Helper Extension is now active!');
}

/**
 * Register all the commands that users can run
 * Commands are what show up in the Command Palette (Ctrl+Shift+P)
 */
function registerCommands(context: vscode.ExtensionContext) {
    
    // ========================
    // Test Commands
    // ========================
    
    const helloWorldCommand = vscode.commands.registerCommand('api-helper-extension.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from API Helper Extension!');
    });
    
    // ========================
    // Environment Management Commands
    // ========================
    
    const addEnvironmentCommand = vscode.commands.registerCommand(
        'api-helper-extension.addEnvironment', 
        addApiEnvironmentHandler
    );
    
    const listEnvironmentsCommand = vscode.commands.registerCommand(
        'api-helper-extension.listEnvironments', 
        listApiEnvironmentsHandler
    );
    
    const deleteEnvironmentCommand = vscode.commands.registerCommand(
        'api-helper-extension.deleteEnvironment', 
        deleteApiEnvironmentHandler
    );
    
    // ========================
    // Schema Loading Commands
    // ========================
    
    const loadSchemaFromUrlCommand = vscode.commands.registerCommand(
        'api-helper-extension.loadSchemaFromUrl', 
        loadSchemaFromUrlHandler
    );
    
    const loadSchemaFromFileCommand = vscode.commands.registerCommand(
        'api-helper-extension.loadSchemaFromFile', 
        loadSchemaFromFileHandler
    );
    
    const showSchemaInfoCommand = vscode.commands.registerCommand(
        'api-helper-extension.showSchemaInfo', 
        showSchemaInfoHandler
    );
    
    // ========================
    // Debug Commands
    // ========================
    
    const showStorageStatsCommand = vscode.commands.registerCommand(
        'api-helper-extension.showStorageStats', 
        showStorageStatsHandler
    );
    
    // Add all commands to the context so they get cleaned up when the extension deactivates
    context.subscriptions.push(
        helloWorldCommand,
        addEnvironmentCommand,
        listEnvironmentsCommand,
        deleteEnvironmentCommand,
        loadSchemaFromUrlCommand,
        loadSchemaFromFileCommand,
        showSchemaInfoCommand,
        showStorageStatsCommand
    );
}

/**
 * Register tree view specific commands
 */
function registerTreeCommands(context: vscode.ExtensionContext) {
    
    // ========================
    // Tree View Commands
    // ========================
    
    const showEnvironmentDetailsCmd = vscode.commands.registerCommand(
        'api-helper-extension.showEnvironmentDetails',
        showEnvironmentDetailsCommand
    );
    
    const showSchemaDetailsCmd = vscode.commands.registerCommand(
        'api-helper-extension.showSchemaDetails',
        showSchemaDetailsCommand
    );
    
    const showEndpointDetailsCmd = vscode.commands.registerCommand(
        'api-helper-extension.showEndpointDetails',
        showEndpointDetailsCommand
    );
    
    const generateCodeCmd = vscode.commands.registerCommand(
        'api-helper-extension.generateCodeForEndpoint',
        generateCodeForEndpointCommand
    );
    
    // ========================
    // Code Generation Commands
    // ========================
    
    const generateCurlCmd = vscode.commands.registerCommand(
        'api-helper-extension.generateCurl',
        (endpoint: any, schemaItem: any) => generateCodeForEndpointCommand(endpoint, schemaItem, 'curl')
    );
    
    const generateAnsibleCmd = vscode.commands.registerCommand(
        'api-helper-extension.generateAnsible',
        (endpoint: any, schemaItem: any) => generateCodeForEndpointCommand(endpoint, schemaItem, 'ansible')
    );
    
    const generatePowerShellCmd = vscode.commands.registerCommand(
        'api-helper-extension.generatePowerShell',
        (endpoint: any, schemaItem: any) => generateCodeForEndpointCommand(endpoint, schemaItem, 'powershell')
    );
    
    const generatePythonCmd = vscode.commands.registerCommand(
        'api-helper-extension.generatePython',
        (endpoint: any, schemaItem: any) => generateCodeForEndpointCommand(endpoint, schemaItem, 'python')
    );
    
    const generateJavaScriptCmd = vscode.commands.registerCommand(
        'api-helper-extension.generateJavaScript',
        (endpoint: any, schemaItem: any) => generateCodeForEndpointCommand(endpoint, schemaItem, 'javascript')
    );
    
    const testEndpointCmd = vscode.commands.registerCommand(
        'api-helper-extension.testEndpoint',
        testEndpointCommand
    );
    
    // ========================
    // Tree View Refresh Commands
    // ========================
    
    const refreshTreeCmd = vscode.commands.registerCommand(
        'api-helper-extension.refreshTree',
        () => treeProvider.refresh()
    );
    
    // Add all tree commands to subscriptions
    context.subscriptions.push(
        showEnvironmentDetailsCmd,
        showSchemaDetailsCmd,
        showEndpointDetailsCmd,
        generateCodeCmd,
        generateCurlCmd,
        generateAnsibleCmd,
        generatePowerShellCmd,
        generatePythonCmd,
        generateJavaScriptCmd,
        testEndpointCmd,
        refreshTreeCmd
    );
}

// ========================
// Command Implementations
// ========================

/**
 * Command to add a new API environment
 * This walks the user through setting up a new environment with authentication
 */
async function addApiEnvironmentHandler() {
    try {
        console.log('Adding new API environment...');
        
        // Ask user for environment details using VS Code's input boxes
        const name = await vscode.window.showInputBox({
            prompt: 'Enter a name for this API environment',
            placeHolder: 'e.g., "Kibana APAC Test"'
        });
        
        if (!name) {
            return; // User cancelled
        }
        
        const baseUrl = await vscode.window.showInputBox({
            prompt: 'Enter the base URL for this API',
            placeHolder: 'e.g., "https://kibana.apac-test-1.sand.wtg.zone"',
            validateInput: (value) => {
                // Basic URL validation
                try {
                    new URL(value);
                    return null; // Valid
                } catch {
                    return 'Please enter a valid URL';
                }
            }
        });
        
        if (!baseUrl) {
            return; // User cancelled
        }
        
        // Ask about authentication type
        const authType = await vscode.window.showQuickPick([
            { label: 'No Authentication', value: 'none' },
            { label: 'API Key', value: 'apikey' },
            { label: 'Bearer Token', value: 'bearer' },
            { label: 'Basic Authentication', value: 'basic' }
        ], {
            placeHolder: 'Select authentication method'
        });
        
        if (!authType) {
            return; // User cancelled
        }
        
        // Create the environment object
        const environment: ApiEnvironment = {
            id: configManager.generateEnvironmentId(),
            name,
            baseUrl,
            auth: { type: authType.value as any },
            createdAt: new Date()
        };
        
        // Handle authentication details based on type
        if (authType.value === 'apikey') {
            const apiKey = await vscode.window.showInputBox({
                prompt: 'Enter your API key',
                password: true // Hide the input
            });
            
            if (!apiKey) {
                return;
            }
            
            const location = await vscode.window.showQuickPick([
                { label: 'Header', value: 'header' },
                { label: 'Query Parameter', value: 'query' }
            ], {
                placeHolder: 'Where should the API key be sent?'
            });
            
            if (!location) {
                return;
            }
            
            const keyName = await vscode.window.showInputBox({
                prompt: 'Enter the header/parameter name for the API key',
                placeHolder: 'e.g., "X-API-Key" or "api_key"'
            });
            
            if (!keyName) {
                return;
            }
            
            environment.auth.apiKey = apiKey;
            environment.auth.apiKeyLocation = location.value as 'header' | 'query';
            environment.auth.apiKeyName = keyName;
            
        } else if (authType.value === 'bearer') {
            const token = await vscode.window.showInputBox({
                prompt: 'Enter your bearer token',
                password: true
            });
            
            if (!token) {
                return;
            }
            
            environment.auth.bearerToken = token;
            
        } else if (authType.value === 'basic') {
            const username = await vscode.window.showInputBox({
                prompt: 'Enter your username'
            });
            
            if (!username) {
                return;
            }
            
            const password = await vscode.window.showInputBox({
                prompt: 'Enter your password',
                password: true
            });
            
            if (!password) {
                return;
            }
            
            environment.auth.username = username;
            environment.auth.password = password;
        }
        
        // Save the environment
        await configManager.saveApiEnvironment(environment);
        
        // Refresh tree view to show new environment
        treeProvider.refresh();
        
        vscode.window.showInformationMessage(`✅ Environment "${name}" has been saved!`);
        
    } catch (error) {
        console.error('Failed to add environment:', error);
        vscode.window.showErrorMessage(`Failed to add environment: ${error}`);
    }
}

/**
 * Command to list all configured environments
 */
async function listApiEnvironmentsHandler() {
    try {
        const environments = await configManager.getApiEnvironments();
        
        if (environments.length === 0) {
            vscode.window.showInformationMessage('No API environments configured. Use "Add API Environment" to create one.');
            return;
        }
        
        // Create a quick pick with all environments
        const items = environments.map(env => ({
            label: env.name,
            description: env.baseUrl,
            detail: `Auth: ${env.auth.type} | Created: ${env.createdAt.toLocaleDateString()}`,
            environment: env
        }));
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select an environment to view details'
        });
        
        if (selected) {
            const env = selected.environment;
            const info = [
                `**${env.name}**`,
                `URL: ${env.baseUrl}`,
                `Authentication: ${env.auth.type}`,
                `Created: ${env.createdAt.toLocaleString()}`,
                env.lastUsed ? `Last Used: ${env.lastUsed.toLocaleString()}` : 'Never used'
            ].join('\\n');
            
            vscode.window.showInformationMessage(info);
        }
        
    } catch (error) {
        console.error('Failed to list environments:', error);
        vscode.window.showErrorMessage(`Failed to list environments: ${error}`);
    }
}

/**
 * Command to delete an API environment
 */
async function deleteApiEnvironmentHandler() {
    try {
        const environments = await configManager.getApiEnvironments();
        
        if (environments.length === 0) {
            vscode.window.showInformationMessage('No API environments to delete.');
            return;
        }
        
        const items = environments.map(env => ({
            label: env.name,
            description: env.baseUrl,
            environment: env
        }));
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select an environment to delete'
        });
        
        if (selected) {
            // Confirm deletion
            const confirmed = await vscode.window.showWarningMessage(
                `Are you sure you want to delete "${selected.environment.name}"?`,
                'Delete',
                'Cancel'
            );
            
            if (confirmed === 'Delete') {
                await configManager.deleteApiEnvironment(selected.environment.id);
                
                // Refresh tree view to remove deleted environment
                treeProvider.refresh();
                
                vscode.window.showInformationMessage(`Environment "${selected.environment.name}" has been deleted.`);
            }
        }
        
    } catch (error) {
        console.error('Failed to delete environment:', error);
        vscode.window.showErrorMessage(`Failed to delete environment: ${error}`);
    }
}

/**
 * Command to load a schema from a URL
 */
async function loadSchemaFromUrlHandler() {
    try {
        // First, user selects an environment
        const environments = await configManager.getApiEnvironments();
        
        if (environments.length === 0) {
            vscode.window.showWarningMessage('No API environments configured. Please add an environment first.');
            return;
        }
        
        const envItems = environments.map(env => ({
            label: env.name,
            description: env.baseUrl,
            environment: env
        }));
        
        const selectedEnv = await vscode.window.showQuickPick(envItems, {
            placeHolder: 'Select the environment for this schema'
        });
        
        if (!selectedEnv) {
            return;
        }
        
        // Ask for the schema URL
        const schemaUrl = await vscode.window.showInputBox({
            prompt: 'Enter the URL for the OpenAPI schema',
            placeHolder: 'e.g., "https://your-api.com/openapi.json"',
            validateInput: (value) => {
                try {
                    new URL(value);
                    return null;
                } catch {
                    return 'Please enter a valid URL';
                }
            }
        });
        
        if (!schemaUrl) {
            return;
        }
        
        // Show progress while loading
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Loading OpenAPI Schema...',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Downloading schema...' });
            
            const loadedSchema = await schemaLoader.loadFromUrl(schemaUrl, selectedEnv.environment);
            
            progress.report({ message: 'Saving schema...' });
            await configManager.saveLoadedSchema(loadedSchema);
            
            // Refresh tree view to show new schema
            treeProvider.refresh();
            
            if (loadedSchema.isValid) {
                const info = schemaLoader.getSchemaInfo(loadedSchema.schema);
                vscode.window.showInformationMessage(
                    `✅ Schema loaded successfully!\\n` +
                    `API: ${info.title} v${info.version}\\n` +
                    `Endpoints: ${info.endpointCount}`
                );
            } else {
                vscode.window.showErrorMessage(
                    `❌ Schema failed to load:\\n${loadedSchema.validationErrors?.join('\\n')}`
                );
            }
        });
        
    } catch (error) {
        console.error('Failed to load schema from URL:', error);
        vscode.window.showErrorMessage(`Failed to load schema: ${error}`);
    }
}

/**
 * Command to load a schema from a file
 */
async function loadSchemaFromFileHandler() {
    try {
        // First, user selects an environment
        const environments = await configManager.getApiEnvironments();
        
        if (environments.length === 0) {
            vscode.window.showWarningMessage('No API environments configured. Please add an environment first.');
            return;
        }
        
        const envItems = environments.map(env => ({
            label: env.name,
            description: env.baseUrl,
            environment: env
        }));
        
        const selectedEnv = await vscode.window.showQuickPick(envItems, {
            placeHolder: 'Select the environment for this schema'
        });
        
        if (!selectedEnv) {
            return;
        }
        
        // Ask user to select a file
        const fileUris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'OpenAPI/Swagger': ['json', 'yaml', 'yml'],
                'All Files': ['*']
            },
            title: 'Select OpenAPI Schema File'
        });
        
        if (!fileUris || fileUris.length === 0) {
            return;
        }
        
        const filePath = fileUris[0].fsPath;
        
        // Show progress while loading
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Loading OpenAPI Schema...',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Parsing schema file...' });
            
            const loadedSchema = await schemaLoader.loadFromFile(filePath, selectedEnv.environment);
            
            progress.report({ message: 'Saving schema...' });
            await configManager.saveLoadedSchema(loadedSchema);
            
            // Refresh tree view to show new schema
            treeProvider.refresh();
            
            if (loadedSchema.isValid) {
                const info = schemaLoader.getSchemaInfo(loadedSchema.schema);
                vscode.window.showInformationMessage(
                    `✅ Schema loaded successfully!\\n` +
                    `API: ${info.title} v${info.version}\\n` +
                    `Endpoints: ${info.endpointCount}`
                );
            } else {
                vscode.window.showErrorMessage(
                    `❌ Schema failed to load:\\n${loadedSchema.validationErrors?.join('\\n')}`
                );
            }
        });
        
    } catch (error) {
        console.error('Failed to load schema from file:', error);
        vscode.window.showErrorMessage(`Failed to load schema: ${error}`);
    }
}

/**
 * Command to show information about loaded schemas
 */
async function showSchemaInfoHandler() {
    try {
        const schemas = await configManager.getLoadedSchemas();
        
        if (schemas.length === 0) {
            vscode.window.showInformationMessage('No schemas loaded. Use "Load Schema" commands to load a schema.');
            return;
        }
        
        const items = schemas.map(schema => {
            const info = schemaLoader.getSchemaInfo(schema.schema);
            return {
                label: info.title,
                description: `v${info.version} | ${info.endpointCount} endpoints`,
                detail: `Environment: ${schema.environmentId} | Loaded: ${schema.loadedAt.toLocaleString()}`,
                schema
            };
        });
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a schema to view details'
        });
        
        if (selected) {
            const info = schemaLoader.getSchemaInfo(selected.schema.schema);
            const details = [
                `**${info.title}** v${info.version}`,
                info.description ? `Description: ${info.description}` : '',
                `Servers: ${info.serverCount}`,
                `Paths: ${info.pathCount}`,
                `Endpoints: ${info.endpointCount}`,
                `Environment: ${selected.schema.environmentId}`,
                `Source: ${selected.schema.source}`,
                `Loaded: ${selected.schema.loadedAt.toLocaleString()}`,
                `Valid: ${selected.schema.isValid ? '✅' : '❌'}`
            ].filter(line => line).join('\\n');
            
            vscode.window.showInformationMessage(details);
        }
        
    } catch (error) {
        console.error('Failed to show schema info:', error);
        vscode.window.showErrorMessage(`Failed to show schema info: ${error}`);
    }
}

/**
 * Debug command to show storage statistics
 */
async function showStorageStatsHandler() {
    try {
        const stats = await configManager.getStorageStats();
        const settings = configManager.getExtensionSettings();
        
        const info = [
            '**API Helper Extension Storage Stats**',
            `Environments: ${stats.environmentCount}`,
            `Schemas: ${stats.schemaCount}`,
            '',
            '**Settings**',
            `Request Timeout: ${settings.requestTimeout}ms`,
            `Default Code Format: ${settings.defaultCodeFormat}`,
            `Auto Validate: ${settings.autoValidateSchemas}`,
            `Max History: ${settings.maxHistoryItems}`
        ].join('\\n');
        
        vscode.window.showInformationMessage(info);
        
    } catch (error) {
        console.error('Failed to show storage stats:', error);
        vscode.window.showErrorMessage(`Failed to show storage stats: ${error}`);
    }
}

/**
 * This method is called when your extension is deactivated
 * Use this to clean up any resources
 */
export function deactivate() {
    console.log('👋 API Helper Extension is shutting down');
}
