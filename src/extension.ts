/**
 * Main Extension Entry Point
 * 
 * This is where VS Code loads our extension. The activate() function is called
 * when the extension starts up, and we register all our commands here.
 * 
 * Think of this as the "main()" function for our extension.
 */

import * as vscode from 'vscode';
let yaml: any;
try { yaml = require('yaml'); } catch {}
import { ConfigurationManager } from './configuration';
import { SchemaLoader } from './schema-loader';
import { ApiTreeProvider } from './tree-provider';
import { HttpRequestRunner } from './http-runner';
import { HttpCodeLensProvider } from './http-codelens';
import { 
    showEnvironmentDetailsCommand, 
    showSchemaDetailsCommand, 
    showEndpointDetailsCommand, 
    generateCodeForEndpointCommand, 
    testEndpointCommand,
    showLoadSchemaOptionsCommand,
    duplicateEnvironmentCommand
} from './tree-commands';
import { AddSchemaWebview } from './webviews/add-schema-form';
import { AddEnvironmentWebview } from './webviews/add-environment-form';
import { AddEnvironmentGroupWebview } from './webviews/add-environment-group-form';
import { EditEnvironmentGroupWebview } from './webviews/edit-environment-group-form';
import { AddSchemaEnvironmentWebview } from './webviews/add-schema-environment-form';
import { AddSchemaEnvironmentGroupWebview } from './webviews/add-schema-environment-group-form';
import { AddEnvironmentToGroupWebview } from './webviews/add-environment-to-group-form';
import { EditEnvironmentWebview } from './webviews/edit-environment-form';
import { ApiEnvironment, EndpointInfo, SchemaEnvironment, SchemaEnvironmentGroup } from './types';

// Global instances that will be used throughout the extension
let configManager: ConfigurationManager;
let schemaLoader: SchemaLoader;
let treeProvider: ApiTreeProvider;
let httpRunner: HttpRequestRunner;

/**
 * This method is called when your extension is activated
 * VS Code calls this when the extension is first needed
 */
export async function activate(context: vscode.ExtensionContext) {
    console.log('🚀 Pathfinder - OpenAPI Explorer is starting up!');
    
    // Initialize our core services
    configManager = new ConfigurationManager(context);
    schemaLoader = new SchemaLoader();
    httpRunner = new HttpRequestRunner(configManager);
    treeProvider = new ApiTreeProvider(configManager, schemaLoader);
    
    // Register the tree view with drag and drop support
    const treeView = vscode.window.createTreeView('pathfinderExplorer', {
        treeDataProvider: treeProvider,
        showCollapseAll: true,
        dragAndDropController: treeProvider
    });
    
    // Register CodeLens provider for HTTP files
    const httpCodeLensProvider = new HttpCodeLensProvider(httpRunner);
    const codeLensProviderDisposable = vscode.languages.registerCodeLensProvider(
        { language: 'http' },
        httpCodeLensProvider
    );
    
    // Register all our commands
    registerCommands(context);
    
    // Register tree view commands
    registerTreeCommands(context);
    
    // Add disposables to subscriptions
    context.subscriptions.push(treeView, codeLensProviderDisposable);
    
    // Force migration to schema-first architecture (auto-migrate)
    await forceSchemaFirstMigration();

    // Set the welcome context key
    await updateWelcomeContext();
    
    console.log('✅ Pathfinder - OpenAPI Explorer is now active!');
}

/**
 * Register all the commands that users can run
 * Commands are what show up in the Command Palette (Ctrl+Shift+P)
 */
function registerCommands(context: vscode.ExtensionContext) {
    
    // ========================
    // Test Commands
    // ========================
    
    const helloWorldCommand = vscode.commands.registerCommand('pathfinder.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from Pathfinder - OpenAPI Explorer!');
    });
    
    // ========================
    // Environment Management Commands
    // ========================
    
    const addEnvironmentCommand = vscode.commands.registerCommand(
        'pathfinder.addEnvironment', 
        () => addApiEnvironmentHandler(context)
    );
    
    const listEnvironmentsCommand = vscode.commands.registerCommand(
        'pathfinder.listEnvironments', 
        listApiEnvironmentsHandler
    );
    


    // ========================
    // New Environment Management Commands
    // ========================
    
    const showLoadSchemaOptionsCmd = vscode.commands.registerCommand(
        'pathfinder.showLoadSchemaOptions',
        (environment: ApiEnvironment) => showLoadSchemaOptionsCommand(environment)
    );
    
    const editEnvironmentCmd = vscode.commands.registerCommand(
        'pathfinder.editEnvironment',
        (environment: SchemaEnvironment) => editEnvironmentHandler(environment, context)
    );
    
    const duplicateEnvironmentCmd = vscode.commands.registerCommand(
        'pathfinder.duplicateEnvironment', 
        (environment: ApiEnvironment) => duplicateEnvironmentCommand(environment, configManager)
    );
    
    // ========================
    // Environment Group Management Commands
    // ========================
    
    const addEnvironmentGroupCommand = vscode.commands.registerCommand(
        'pathfinder.addEnvironmentGroup',
        () => addEnvironmentGroupHandler(context)
    );
    
    const editGroupCommand = vscode.commands.registerCommand(
        'pathfinder.editGroup',
        (group: any) => editGroupHandler(group, context)
    );
    

    

    

    

    

    
    // ========================
    // Schema Loading Commands
    // ========================
    
    const loadSchemaFromUrlCommand = vscode.commands.registerCommand(
        'pathfinder.loadSchemaFromUrl', 
        (environment?: ApiEnvironment) => loadSchemaFromUrlHandler(environment)
    );
    
    const loadSchemaFromFileCommand = vscode.commands.registerCommand(
        'pathfinder.loadSchemaFromFile', 
        (environment?: ApiEnvironment) => loadSchemaFromFileHandler(environment)
    );
    
    const showSchemaInfoCommand = vscode.commands.registerCommand(
        'pathfinder.showSchemaInfo', 
        showSchemaInfoHandler
    );
    
    // ========================
    // Debug Commands
    // ========================
    
    const showStorageStatsCommand = vscode.commands.registerCommand(
        'pathfinder.showStorageStats', 
        showStorageStatsHandler
    );

    const resetSessionCommand = vscode.commands.registerCommand(
        'pathfinder.resetSession',
        async () => {
            await configManager.clearAllData();
            treeProvider.refresh();
            await updateWelcomeContext();
            vscode.window.showInformationMessage('Pathfinder session has been reset to defaults.');
        }
    );

    const factoryResetCommand = vscode.commands.registerCommand(
        'pathfinder.factoryReset',
        async () => {
            // Remove all user data: environments, groups, schemas, and settings
            await configManager.clearAllData();

            // Clear globalState and workspaceState
            try {
                await Promise.all([
                    ...context.globalState.keys().map(k => context.globalState.update(k, undefined)),
                    ...context.workspaceState.keys().map(k => context.workspaceState.update(k, undefined))
                ]);
            } catch (e) {
                console.error('Failed to clear global/workspace state:', e);
            }

            // Delete all files in globalStorageUri and storageUri
            async function deleteAllFilesInDir(uri: vscode.Uri) {
                try {
                    const entries = await vscode.workspace.fs.readDirectory(uri);
                    for (const [name, type] of entries) {
                        const entryUri = vscode.Uri.joinPath(uri, name);
                        if (type === vscode.FileType.Directory) {
                            await deleteAllFilesInDir(entryUri);
                            await vscode.workspace.fs.delete(entryUri, { recursive: true, useTrash: false });
                        } else {
                            await vscode.workspace.fs.delete(entryUri, { useTrash: false });
                        }
                    }
                } catch (e) {
                    // Log and ignore if dir doesn't exist or can't be read
                    console.warn(`Could not delete files in ${uri.fsPath}:`, e);
                }
            }
            if (context.globalStorageUri) {
                await deleteAllFilesInDir(context.globalStorageUri);
            }
            if (context.storageUri ?? false) {
                await deleteAllFilesInDir(context.storageUri!);
            }

            // Reset all extension settings under 'pathfinder' (global and workspace)
            const config = vscode.workspace.getConfiguration('pathfinder');
            const settings = [
                'requestTimeout',
                'defaultCodeFormat',
                'autoValidateSchemas',
                'maxHistoryItems'
            ];
            for (const setting of settings) {
                await config.update(setting, undefined, vscode.ConfigurationTarget.Global);
                await config.update(setting, undefined, vscode.ConfigurationTarget.Workspace);
            }

            treeProvider.refresh();
            await updateWelcomeContext();
            const reload = await vscode.window.showInformationMessage(
                'Pathfinder has been factory reset. All user data and settings have been removed. Reload window now?',
                'Reload Window', 'Later'
            );
            if (reload === 'Reload Window') {
                await vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        }
    );
    
    // ========================
    // Schema-First Architecture Commands (NEW)
    // ========================
    
    const addApiSchemaCommand = vscode.commands.registerCommand(
        'pathfinder.addApiSchema',
        () => addApiSchemaHandler(context)
    );
    
    const editSchemaGroupCommand = vscode.commands.registerCommand(
        'pathfinder.editSchemaGroup',
        (group: any) => editSchemaGroupHandler(group)
    );
    
    const editSchemaCommand = vscode.commands.registerCommand(
        'pathfinder.editSchema',
        (schema: any) => editSchemaHandler(schema, context)
    );
    
    const addEnvironmentForSchemaCommand = vscode.commands.registerCommand(
        'pathfinder.addEnvironmentForSchema',
        (schema: any) => addEnvironmentForSchemaHandler(schema, context)
    );
    
    const deleteSchemaCommand = vscode.commands.registerCommand(
        'pathfinder.deleteSchema',
        (schema: any) => deleteSchemaHandler(schema)
    );
    
    const deleteSchemaEnvironmentCommand = vscode.commands.registerCommand(
        'pathfinder.deleteSchemaEnvironment',
        (environment: any) => deleteSchemaEnvironmentHandler(environment)
    );
    
    const deleteSchemaEnvironmentGroupCommand = vscode.commands.registerCommand(
        'pathfinder.deleteSchemaEnvironmentGroup',
        (group: any) => deleteSchemaEnvironmentGroupHandler(group)
    );
    
    const changeSchemaColorCommand = vscode.commands.registerCommand(
        'pathfinder.changeSchemaColor',
        (schema: any) => changeSchemaColorHandler(schema)
    );
    
    const changeEnvironmentGroupColorCommand = vscode.commands.registerCommand(
        'pathfinder.changeEnvironmentGroupColor',
        (group: any) => changeEnvironmentGroupColorHandler(group)
    );
    
    const addSchemaToGroupCommand = vscode.commands.registerCommand(
        'pathfinder.addSchemaToGroup',
        (group: any) => addSchemaToGroupHandler(group)
    );
    
    const migrateToSchemaFirstCommand = vscode.commands.registerCommand(
        'pathfinder.migrateToSchemaFirst',
        migrateToSchemaFirstHandler
    );
    
    const addSchemaEnvironmentGroupCommand = vscode.commands.registerCommand(
        'pathfinder.addSchemaEnvironmentGroup',
        (schema: any) => addSchemaEnvironmentGroupHandler(schema, context)
    );
    
    const addEnvironmentToGroupCommand2 = vscode.commands.registerCommand(
        'pathfinder.addEnvironmentToGroup',
        (group: any, schema: any) => addEnvironmentToGroupHandler2(group, schema, context)
    );
    
    const editEnvironmentGroupCommand = vscode.commands.registerCommand(
        'pathfinder.editEnvironmentGroup',
        (group: any) => editEnvironmentGroupHandler(group, context)
    );

    // ========================
    // Rename Commands
    // ========================

    const renameSchemaCommand = vscode.commands.registerCommand(
        'pathfinder.renameSchema',
        (schema: any) => renameSchemaHandler(schema)
    );

    const renameEnvironmentCommand = vscode.commands.registerCommand(
        'pathfinder.renameEnvironment',
        (environment: any) => renameEnvironmentHandler(environment)
    );

    const renameGroupCommand = vscode.commands.registerCommand(
        'pathfinder.renameGroup',
        (group: any) => renameGroupHandler(group)
    );
    
    // ========================
    // Configuration Import/Export Commands
    // ========================
    
    const exportConfigurationCommand = vscode.commands.registerCommand(
        'pathfinder.exportConfiguration',
        async () => {
            try {
                // Get the configuration data
                const configData = await configManager.exportConfiguration();
                
                // Ask user where to save the file
                const fileUri = await vscode.window.showSaveDialog({
                    filters: {
                        'JSON': ['json']
                    },
                    title: 'Export Pathfinder Configuration'
                });
                
                if (!fileUri) {
                    return; // User cancelled
                }
                
                // Write the file
                await vscode.workspace.fs.writeFile(
                    fileUri,
                    Buffer.from(configData, 'utf8')
                );
                
                vscode.window.showInformationMessage(
                    `Configuration exported successfully to ${fileUri.fsPath}`
                );
                
            } catch (error) {
                console.error('Failed to export configuration:', error);
                vscode.window.showErrorMessage(
                    `Failed to export configuration: ${error}`
                );
            }
        }
    );
    
    const importConfigurationCommand = vscode.commands.registerCommand(
        'pathfinder.importConfiguration',
        async () => {
            try {
                // Ask user to select a file
                const fileUris = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: {
                        'JSON': ['json']
                    },
                    title: 'Import Pathfinder Configuration'
                });
                
                if (!fileUris || fileUris.length === 0) {
                    return; // User cancelled
                }
                
                // Read the file
                const fileData = await vscode.workspace.fs.readFile(fileUris[0]);
                const configData = Buffer.from(fileData).toString('utf8');
                
                // Confirm with user
                const confirm = await vscode.window.showWarningMessage(
                    'This will merge the imported configuration with your existing settings. Continue?',
                    { modal: true },
                    'Import'
                );
                
                if (confirm !== 'Import') {
                    return;
                }
                
                // Import the configuration
                const importedData = await configManager.importConfiguration(configData);
                
                // Refresh the tree view
                treeProvider.refresh();
                await updateWelcomeContext();
                
                // Check if we need to set credentials
                const needsCredentials = [
                    ...importedData.environments.filter((env: any) => env.auth?.type !== 'none'),
                    ...importedData.environmentGroups.filter((group: any) => group.auth?.type !== 'none')
                ];

                if (needsCredentials.length > 0) {
                    const setCredentials = await vscode.window.showInformationMessage(
                        'Some environments and groups need credentials set. Would you like to set them now?',
                        'Set Credentials',
                        'Later'
                    );

                    if (setCredentials === 'Set Credentials') {
                        // Import the CredentialForm
                        const { CredentialForm } = await import('./webviews/credential-form.js');

                        // Set credentials for each item that needs them
                        for (const item of needsCredentials) {
                            const credentialForm = new CredentialForm(
                                context,
                                configManager,
                                item,
                                () => treeProvider.refresh()
                            );
                            await credentialForm.show();
                        }
                    }
                }
                
                vscode.window.showInformationMessage(
                    'Configuration imported successfully'
                );
                
            } catch (error) {
                console.error('Failed to import configuration:', error);
                vscode.window.showErrorMessage(
                    `Failed to import configuration: ${error}`
                );
            }
        }
    );

    // Add all commands to the context so they get cleaned up when the extension deactivates
    context.subscriptions.push(
        helloWorldCommand,
        addEnvironmentCommand,
        listEnvironmentsCommand,
        showLoadSchemaOptionsCmd,
        editEnvironmentCmd,
        duplicateEnvironmentCmd,
        addEnvironmentGroupCommand,
        editGroupCommand,
        loadSchemaFromUrlCommand,
        loadSchemaFromUrlCommand,
        loadSchemaFromFileCommand,
        showSchemaInfoCommand,
        showStorageStatsCommand,
        resetSessionCommand,
        factoryResetCommand,
        addApiSchemaCommand,
        editSchemaGroupCommand,
        editSchemaCommand,
        addEnvironmentForSchemaCommand,
        deleteSchemaCommand,
        deleteSchemaEnvironmentCommand,
        deleteSchemaEnvironmentGroupCommand,
        changeSchemaColorCommand,
        changeEnvironmentGroupColorCommand,
        addSchemaToGroupCommand,
        addSchemaEnvironmentGroupCommand,
        addEnvironmentToGroupCommand2,
        editEnvironmentGroupCommand,
        migrateToSchemaFirstCommand,
        renameSchemaCommand,
        renameEnvironmentCommand,
        renameGroupCommand,
        exportConfigurationCommand,
        importConfigurationCommand
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
        'pathfinder.showEnvironmentDetails',
        showEnvironmentDetailsCommand
    );
    
    const showSchemaDetailsCmd = vscode.commands.registerCommand(
        'pathfinder.showSchemaDetails',
        showSchemaDetailsCommand
    );
    
    const showEndpointDetailsCmd = vscode.commands.registerCommand(
        'pathfinder.showEndpointDetails',
        showEndpointDetailsCommand
    );
    
    const generateCodeCmd = vscode.commands.registerCommand(
        'pathfinder.generateCodeForEndpoint',
        generateCodeForEndpointCommand
    );
    
    // ========================
    // Code Generation Commands
    // ========================
    
    const generateCurlCmd = vscode.commands.registerCommand(
        'pathfinder.generateCurl',
        (endpoint: any, schemaItem: any) => generateCodeForEndpointCommand(endpoint, schemaItem, 'curl')
    );
    
    const generateAnsibleCmd = vscode.commands.registerCommand(
        'pathfinder.generateAnsible',
        (endpoint: any, schemaItem: any) => generateCodeForEndpointCommand(endpoint, schemaItem, 'ansible')
    );
    
    const generatePowerShellCmd = vscode.commands.registerCommand(
        'pathfinder.generatePowerShell',
        (endpoint: any, schemaItem: any) => generateCodeForEndpointCommand(endpoint, schemaItem, 'powershell')
    );
    
    const generatePythonCmd = vscode.commands.registerCommand(
        'pathfinder.generatePython',
        (endpoint: any, schemaItem: any) => generateCodeForEndpointCommand(endpoint, schemaItem, 'python')
    );
    
    const generateJavaScriptCmd = vscode.commands.registerCommand(
        'pathfinder.generateJavaScript',
        (endpoint: any, schemaItem: any) => generateCodeForEndpointCommand(endpoint, schemaItem, 'javascript')
    );
    
    const testEndpointCmd = vscode.commands.registerCommand(
        'pathfinder.testEndpoint',
        testEndpointCommand
    );
    
    const runHttpRequestCmd = vscode.commands.registerCommand(
        'pathfinder.runHttpRequest',
        (endpoint: any, schemaItem: any, environment: any, context: vscode.ExtensionContext) => runHttpRequestCommand(endpoint, schemaItem, environment, context)
    );
    
    const executeHttpRequestCmd = vscode.commands.registerCommand(
        'pathfinder.executeHttpRequest',
        executeHttpRequestCommand
    );
    
    const toggleAuthVisibilityCmd = vscode.commands.registerCommand(
        'pathfinder.toggleAuthVisibility',
        toggleAuthVisibilityCommand
    );
    
    // ========================
    // Tree View Refresh Commands
    // ========================
    
    const refreshTreeCmd = vscode.commands.registerCommand(
        'pathfinder.refreshTree',
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
        runHttpRequestCmd,
        executeHttpRequestCmd,
        toggleAuthVisibilityCmd,
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
async function addApiEnvironmentHandler(context: vscode.ExtensionContext) {
    try {
        console.log('Opening add environment webview form...');
        
        // First, let user select a schema
        const schemas = await configManager.getApiSchemas();
        if (schemas.length === 0) {
            vscode.window.showInformationMessage('No schemas available. Please add a schema first.');
            return;
        }

        const selectedSchema = await vscode.window.showQuickPick(
            schemas.map(schema => ({
                label: schema.name,
                description: `v${schema.version}`,
                value: schema
            })),
            { placeHolder: 'Select a schema for this environment' }
        );

        if (!selectedSchema) {
            return;
        }
        
        const addEnvironmentWebview = new AddEnvironmentWebview(
            context,
            configManager,
            selectedSchema.value.id,
            () => {
                treeProvider.refresh();
            }
        );
        
        await addEnvironmentWebview.show();
        await updateWelcomeContext();
        
    } catch (error) {
        console.error('Failed to open add environment form:', error);
        vscode.window.showErrorMessage(`Failed to open add environment form: ${error}`);
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
 * Command to load a schema from a URL
 */
async function loadSchemaFromUrlHandler(environment?: ApiEnvironment) {
    try {
        let selectedEnv: ApiEnvironment;
        
        if (environment) {
            // Environment already provided (from tree view)
            selectedEnv = environment;
        } else {
            // Need to select environment (from command palette)
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
            
            const selectedEnvItem = await vscode.window.showQuickPick(envItems, {
                placeHolder: 'Select the environment for this schema'
            });
            
            if (!selectedEnvItem) {
                return;
            }
            
            selectedEnv = selectedEnvItem.environment;
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
            
            const loadedSchema = await schemaLoader.loadFromUrl(schemaUrl, selectedEnv);
            
            progress.report({ message: 'Saving schema...' });
            await configManager.saveLoadedSchema(loadedSchema);
            
            // Refresh tree view to show new schema
            treeProvider.refresh();
            await updateWelcomeContext();
            
            if (loadedSchema.isValid) {
                const info = schemaLoader.getSchemaInfo(loadedSchema.schema);
                const platformInfo = loadedSchema.platformConfig?.platform ? 
                    ` | Platform: ${loadedSchema.platformConfig.platform}` : '';
                const headerInfo = loadedSchema.platformConfig?.requiredHeaders && 
                    Object.keys(loadedSchema.platformConfig.requiredHeaders).length > 0 ?
                    ` | Auto-headers: ${Object.keys(loadedSchema.platformConfig.requiredHeaders).join(', ')}` : '';
                
                vscode.window.showInformationMessage(
                    `✅ Schema loaded successfully!\n` +
                    `API: ${info.title} v${info.version}\n` +
                    `Endpoints: ${info.endpointCount}${platformInfo}${headerInfo}`
                );
            } else {
                // Schema loaded but has validation issues - show as warning, not error
                const info = schemaLoader.getSchemaInfo(loadedSchema.schema);
                const errorCount = loadedSchema.validationErrors?.length ?? 0;
                const errorSummary = errorCount > 3 
                    ? `${loadedSchema.validationErrors?.slice(0, 3).join(', ')} (and ${errorCount - 3} more)`
                    : loadedSchema.validationErrors?.join(', ') ?? 'Unknown validation issues';
                
                vscode.window.showWarningMessage(
                    `⚠️ Schema loaded with validation warnings:\n` +
                    `API: ${info.title} v${info.version} (${info.endpointCount} endpoints)\n` +
                    `${errorCount} validation issue(s): ${errorSummary}`
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
async function loadSchemaFromFileHandler(environment?: ApiEnvironment) {
    try {
        let selectedEnv: ApiEnvironment;
        
        if (environment) {
            // Environment already provided (from tree view)
            selectedEnv = environment;
        } else {
            // Need to select environment (from command palette)
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
            
            const selectedEnvItem = await vscode.window.showQuickPick(envItems, {
                placeHolder: 'Select the environment for this schema'
            });
            
            if (!selectedEnvItem) {
                return;
            }
            
            selectedEnv = selectedEnvItem.environment;
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
            
            const loadedSchema = await schemaLoader.loadFromFile(filePath, selectedEnv);
            
            progress.report({ message: 'Saving schema...' });
            await configManager.saveLoadedSchema(loadedSchema);
            
            // Refresh tree view to show new schema
            treeProvider.refresh();
            await updateWelcomeContext();
            
            if (loadedSchema.isValid) {
                const info = schemaLoader.getSchemaInfo(loadedSchema.schema);
                const platformInfo = loadedSchema.platformConfig?.platform ? 
                    ` | Platform: ${loadedSchema.platformConfig.platform}` : '';
                const headerInfo = loadedSchema.platformConfig?.requiredHeaders && 
                    Object.keys(loadedSchema.platformConfig.requiredHeaders).length > 0 ?
                    ` | Auto-headers: ${Object.keys(loadedSchema.platformConfig.requiredHeaders).join(', ')}` : '';
                
                vscode.window.showInformationMessage(
                    `✅ Schema loaded successfully!\n` +
                    `API: ${info.title} v${info.version}\n` +
                    `Endpoints: ${info.endpointCount}${platformInfo}${headerInfo}`
                );
            } else {
                // Schema loaded but has validation issues - show as warning, not error
                const info = schemaLoader.getSchemaInfo(loadedSchema.schema);
                const errorCount = loadedSchema.validationErrors?.length ?? 0;
                const errorSummary = errorCount > 3 
                    ? `${loadedSchema.validationErrors?.slice(0, 3).join(', ')} (and ${errorCount - 3} more)`
                    : loadedSchema.validationErrors?.join(', ') ?? 'Unknown validation issues';
                
                vscode.window.showWarningMessage(
                    `⚠️ Schema loaded with validation warnings:\n` +
                    `API: ${info.title} v${info.version} (${info.endpointCount} endpoints)\n` +
                    `${errorCount} validation issue(s): ${errorSummary}`
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

// ========================
// Environment Group Management Handlers
// ========================

/**
 * Command to add a new environment group
 */
async function addEnvironmentGroupHandler(context: vscode.ExtensionContext) {
    try {
        console.log('Opening add environment group webview form...');
        
        // First, let user select a schema
        const schemas = await configManager.getApiSchemas();
        if (schemas.length === 0) {
            vscode.window.showInformationMessage('No schemas available. Please add a schema first.');
            return;
        }

        const selectedSchema = await vscode.window.showQuickPick(
            schemas.map(schema => ({
                label: schema.name,
                description: `v${schema.version}`,
                value: schema
            })),
            { placeHolder: 'Select a schema for this group' }
        );

        if (!selectedSchema) {
            return;
        }
        
        const addGroupWebview = new AddEnvironmentGroupWebview(
            context,
            configManager,
            selectedSchema.value.id,
            () => {
                treeProvider.refresh();
            }
        );
        
        await addGroupWebview.show();
        await updateWelcomeContext();
        
    } catch (error) {
        console.error('Failed to open add environment group form:', error);
        vscode.window.showErrorMessage(`Failed to open add environment group form: ${error}`);
    }
}

/**
 * Command to edit an environment group
 */
async function editGroupHandler(group: any, context: vscode.ExtensionContext) {
    try {
        console.log('Opening edit environment group webview form...');
        
        // Create and show the edit environment group webview form
        const editEnvironmentGroupWebview = new EditEnvironmentGroupWebview(
            context,
            configManager,
            group,
            () => {
                // Callback when group is updated - refresh the tree
                treeProvider.refresh();
            }
        );
        
        await editEnvironmentGroupWebview.show();
        await updateWelcomeContext();
        
    } catch (error) {
        console.error('Failed to open edit environment group form:', error);
        vscode.window.showErrorMessage(`Failed to open edit environment group form: ${error}`);
    }
}

/**
 * Ensure all required secrets for an environment are present in SecretStorage.
 * If missing, prompt the user and store them securely.
 */
async function ensureEnvironmentSecrets(context: vscode.ExtensionContext, environment: any) {
    const auth = environment.auth ?? {};
    // API Key
    if (auth.type === 'apikey' && auth.apiKeySecret) {
        const existing = await context.secrets.get(auth.apiKeySecret);
        if (!existing) {
            const apiKey = await vscode.window.showInputBox({
                prompt: `Enter API key for environment "${environment.name}"`,
                password: true
            });
            if (apiKey) {
                await context.secrets.store(auth.apiKeySecret, apiKey);
            } else {
                throw new Error('API key is required for this environment.');
            }
        }
    }
    // Bearer Token
    if (auth.type === 'bearer' && auth.bearerTokenSecret) {
        const existing = await context.secrets.get(auth.bearerTokenSecret);
        if (!existing) {
            const token = await vscode.window.showInputBox({
                prompt: `Enter bearer token for environment "${environment.name}"`,
                password: true
            });
            if (token) {
                await context.secrets.store(auth.bearerTokenSecret, token);
            } else {
                throw new Error('Bearer token is required for this environment.');
            }
        }
    }
    // Basic Auth Password
    if (auth.type === 'basic' && auth.passwordSecret) {
        const existing = await context.secrets.get(auth.passwordSecret);
        if (!existing) {
            const password = await vscode.window.showInputBox({
                prompt: `Enter password for environment "${environment.name}"`,
                password: true
            });
            if (password) {
                await context.secrets.store(auth.passwordSecret, password);
            } else {
                throw new Error('Password is required for this environment.');
            }
        }
    }
}

/**
 * Command to run HTTP request from endpoint
 */
async function runHttpRequestCommand(endpoint: any, schemaItem: any, environment: any, context: vscode.ExtensionContext) {
    try {
        if (!environment) {
            vscode.window.showErrorMessage('Environment not found');
            return;
        }

        // Ensure secrets are present
        await ensureEnvironmentSecrets(context, environment);

        // Get the schema's platform configuration if available
        const schemas = await configManager.getLoadedSchemas(environment.id);
        const platformConfig = schemas.length > 0 ? schemas[0].platformConfig : undefined;

        // Create EndpointInfo from the endpoint data
        const endpointInfo: EndpointInfo = {
            path: endpoint.path,
            method: endpoint.method,
            summary: endpoint.summary,
            description: endpoint.description,
            parameters: endpoint.parameters ?? [],
            tags: endpoint.tags ?? []
        };

        // Open HTTP request editor with platform configuration
        await httpRunner.openRequestEditor(endpointInfo, environment, platformConfig);
        
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to open HTTP request: ${error}`);
    }
}

/**
 * Command to execute HTTP request from CodeLens
 */
async function executeHttpRequestCommand(documentUri: vscode.Uri, lineNumber: number) {
    try {
        const document = await vscode.workspace.openTextDocument(documentUri);
        const content = document.getText();
        
        const request = httpRunner.parseHttpRequestWithCredentials(content, documentUri.toString());
        if (!request) {
            vscode.window.showErrorMessage('Invalid HTTP request format');
            return;
        }

        // Execute the request
        const response = await httpRunner.executeRequest(request);
        
        // Display the response
        await httpRunner.displayResponse(response, request);
        
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to execute HTTP request: ${error}`);
    }
}

/**
 * Command to toggle authorization header visibility
 */
async function toggleAuthVisibilityCommand(documentUri: vscode.Uri) {
    try {
        const document = await vscode.workspace.openTextDocument(documentUri);
        await httpRunner.toggleAuthVisibility(document);
        
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to toggle auth visibility: ${error}`);
    }
}

// ========================
// Schema-First Architecture Command Handlers (NEW)
// ========================

/**
 * Command to add a new API schema in schema-first architecture
 */
async function addApiSchemaHandler(context: vscode.ExtensionContext) {
    try {
        console.log('Opening add schema webview form...');
        
        // Create and show the webview form
        const addSchemaWebview = new AddSchemaWebview(
            context,
            configManager,
            schemaLoader,
            () => {
                // Callback when schema is added - refresh the tree
                treeProvider.refresh();
            }
        );
        
        await addSchemaWebview.show();
        await updateWelcomeContext();
        
    } catch (error) {
        console.error('Failed to open add schema form:', error);
        vscode.window.showErrorMessage(`Failed to open add schema form: ${error}`);
    }
}

/**
 * Command to load a new schema in schema-first architecture
 */
async function loadNewSchemaHandler(name?: string, description?: string) {
    try {
        console.log('Loading new schema...');
        
        if (!name) {
            name = await vscode.window.showInputBox({
                prompt: 'Enter a name for this schema',
                placeHolder: 'e.g., "Kibana API v8.0"'
            });
            
            if (!name) {
                return;
            }
        }
        
        const loadMethod = await vscode.window.showQuickPick([
            { label: '🌐 Load from URL', value: 'url' },
            { label: '📁 Load from file', value: 'file' }
        ], {
            placeHolder: 'How would you like to load the schema?'
        });
        
        if (!loadMethod) {
            return;
        }
        
        let schemaData;
        let source;
        
        if (loadMethod.value === 'url') {
            const url = await vscode.window.showInputBox({
                prompt: 'Enter the URL to the OpenAPI schema',
                placeHolder: 'e.g., https://api.example.com/openapi.json'
            });
            
            if (!url) {
                return;
            }
            
            source = url;
            // Create a temporary environment for loading
            const tempEnv = {
                id: 'temp',
                name: 'temp',
                baseUrl: url,
                auth: { type: 'none' as const },
                createdAt: new Date()
            };
            schemaData = await schemaLoader.loadFromUrl(url, tempEnv);
        } else {
            const fileUri = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: {
                    'OpenAPI Files': ['json', 'yaml', 'yml']
                }
            });
            
            if (!fileUri || fileUri.length === 0) {
                return;
            }
            
            source = fileUri[0].fsPath;
            // Create a temporary environment for loading
            const tempEnv = {
                id: 'temp',
                name: 'temp',
                baseUrl: 'file://' + fileUri[0].fsPath,
                auth: { type: 'none' as const },
                createdAt: new Date()
            };
            schemaData = await schemaLoader.loadFromFile(fileUri[0].fsPath, tempEnv);
        }
        
        if (!schemaData) {
            vscode.window.showErrorMessage('Failed to load schema');
            return;
        }
        
        // Create new ApiSchema object
        const newSchema = {
            id: `schema_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            name,
            description,
            schema: schemaData.schema, // Extract the actual OpenAPI document
            source,
            loadedAt: new Date(),
            lastUpdated: new Date(),
            isValid: schemaData.isValid,
            validationErrors: schemaData.validationErrors || [],
            version: schemaData.schema.info?.version || '1.0.0'
        };
        
        await configManager.saveApiSchema(newSchema);
        treeProvider.refresh();
        await updateWelcomeContext();
        
        vscode.window.showInformationMessage(`Schema "${name}" loaded successfully!`);
        
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to load schema: ${error}`);
    }
}

/**
 * Command to edit an environment group
 */
async function editSchemaGroupHandler(group: any) {
    try {
        console.log('Editing environment group:', group.name);
        
        const name = await vscode.window.showInputBox({
            prompt: 'Edit group name',
            value: group.name
        });
        
        if (!name) {
            return;
        }
        
        const description = await vscode.window.showInputBox({
            prompt: 'Edit group description',
            value: group.description || ''
        });
        
        const updatedGroup = {
            ...group,
            name,
            description
        };
        
        await configManager.saveApiSchemaGroup(updatedGroup);
        treeProvider.refresh();
        await updateWelcomeContext();
        
        vscode.window.showInformationMessage(`Environment group "${name}" updated successfully!`);
        
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to edit environment group: ${error}`);
    }
}

/**
 * Command to add a new environment group within a schema
 */
async function addSchemaEnvironmentGroupHandler(schema: any, context: vscode.ExtensionContext) {
    try {
        console.log('Opening add schema environment group webview form...');
        
        // Create and show the add schema environment group webview form
        const addSchemaEnvironmentGroupWebview = new AddSchemaEnvironmentGroupWebview(
            context,
            configManager,
            schema,
            () => {
                // Callback when group is added - refresh the tree
                treeProvider.refresh();
            }
        );
        
        await addSchemaEnvironmentGroupWebview.show();
        await updateWelcomeContext();
        
    } catch (error) {
        console.error('Failed to open add schema environment group form:', error);
        vscode.window.showErrorMessage(`Failed to open add schema environment group form: ${error}`);
    }
}

/**
 * Command to add an environment to an environment group within a schema
 */
async function addEnvironmentToGroupHandler2(group: any, schema: any, context: vscode.ExtensionContext) {
    try {
        console.log('Opening add environment to group webview form...');
        
        // Create and show the add environment to group webview form
        const addEnvironmentToGroupWebview = new AddEnvironmentToGroupWebview(
            context,
            configManager,
            group,
            schema,
            () => {
                // Callback when environment is added - refresh the tree
                treeProvider.refresh();
            }
        );
        
        await addEnvironmentToGroupWebview.show();
        await updateWelcomeContext();
        
    } catch (error) {
        console.error('Failed to open add environment to group form:', error);
        vscode.window.showErrorMessage(`Failed to open add environment to group form: ${error}`);
    }
}

/**
 * Command to edit an environment group
 */
async function editEnvironmentGroupHandler(group: any, context: vscode.ExtensionContext) {
    try {
        console.log('Opening edit environment group webview form...');
        
        // Create and show the edit environment group webview form
        const editEnvironmentGroupWebview = new EditEnvironmentGroupWebview(
            context,
            configManager,
            group,
            () => {
                // Callback when group is updated - refresh the tree
                treeProvider.refresh();
            }
        );
        
        await editEnvironmentGroupWebview.show();
        await updateWelcomeContext();
        
    } catch (error) {
        console.error('Failed to open edit environment group form:', error);
        vscode.window.showErrorMessage(`Failed to open edit environment group form: ${error}`);
    }
}

/**
 * Command to add schema to group
 */
async function addSchemaToGroupHandler(group: any) {
    try {
        console.log('Adding schema to group:', group.name);
        
        const schemas = await configManager.getUngroupedSchemas();
        
        if (schemas.length === 0) {
            vscode.window.showInformationMessage('No ungrouped schemas available');
            return;
        }
        
        const selectedSchema = await vscode.window.showQuickPick(
            schemas.map(schema => ({
                label: schema.name,
                description: schema.description,
                value: schema
            })),
            {
                placeHolder: 'Select a schema to add to the group'
            }
        );
        
        if (!selectedSchema) {
            return;
        }
        
        const updatedSchema = {
            ...selectedSchema.value,
            groupId: group.id
        };
        
        await configManager.saveApiSchema(updatedSchema);
        treeProvider.refresh();
        await updateWelcomeContext();
        
        vscode.window.showInformationMessage(`Schema "${selectedSchema.label}" added to group "${group.name}"!`);
        
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to add schema to group: ${error}`);
    }
}

/**
 * Command to add environment in schema-first architecture
 */
async function addEnvironmentHandler() {
    try {
        console.log('Adding new environment in schema-first architecture...');
        
        const schemas = await configManager.getApiSchemas();
        
        if (schemas.length === 0) {
            vscode.window.showInformationMessage('No schemas available. Please add a schema first.');
            return;
        }
        
        const selectedSchema = await vscode.window.showQuickPick(
            schemas.map(schema => ({
                label: schema.name,
                description: `v${schema.version} - ${schema.description || 'No description'}`,
                value: schema
            })),
            {
                placeHolder: 'Select a schema for this environment'
            }
        );
        
        if (!selectedSchema) {
            return;
        }
        
        const name = await vscode.window.showInputBox({
            prompt: 'Enter a name for this environment',
            placeHolder: 'e.g., "Production"'
        });
        
        if (!name) {
            return;
        }
        
        const baseUrl = await vscode.window.showInputBox({
            prompt: 'Enter the base URL for this environment',
            placeHolder: 'e.g., "https://api.production.com"',
            validateInput: (value) => {
                try {
                    new URL(value);
                    return null;
                } catch {
                    return 'Please enter a valid URL';
                }
            }
        });
        
        if (!baseUrl) {
            return;
        }
        
        const newEnvironment = {
            id: `env_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            schemaId: selectedSchema.value.id,
            name,
            baseUrl,
            auth: { type: 'none' as const },
            createdAt: new Date()
        };
        
        await configManager.saveSchemaEnvironment(newEnvironment);
        treeProvider.refresh();
        await updateWelcomeContext();
        
        vscode.window.showInformationMessage(`Environment "${name}" created successfully!`);
        
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to add environment: ${error}`);
    }
}

/**
 * Command to migrate from environment-first to schema-first architecture
 */
async function migrateToSchemaFirstHandler() {
    try {
        console.log('Starting migration to schema-first architecture...');
        
        const confirm = await vscode.window.showWarningMessage(
            'This will migrate your environments to the new schema-first architecture. This action cannot be easily undone. Do you want to continue?',
            'Yes, Migrate', 'Cancel'
        );
        
        if (confirm !== 'Yes, Migrate') {
            return;
        }
        
        // Import the migration utility
        const { DataMigration } = require('./migration/data-migration');
        const migration = new DataMigration(configManager, schemaLoader);
        
        const result = await migration.migrateToSchemaFirst();
        
        if (result.success) {
            await configManager.setMigrationComplete();
            treeProvider.refresh();
            await updateWelcomeContext();
            
            vscode.window.showInformationMessage(
                `Migration completed! ${result.schemasCreated} schemas and ${result.environmentsMigrated} environments migrated.`
            );
        } else {
            vscode.window.showErrorMessage(`Migration failed: ${result.error}`);
        }
        
    } catch (error) {
        vscode.window.showErrorMessage(`Migration failed: ${error}`);
    }
}

/**
 * Force migration to schema-first architecture on extension startup
 * This automatically migrates any existing environment-first data
 */
async function forceSchemaFirstMigration() {
    try {
        const isMigrationComplete = await configManager.isMigrationComplete();
        
        if (!isMigrationComplete) {
            console.log('🔄 Auto-migrating to schema-first architecture...');
            
            // Check if there are existing environments that need migration
            const environments = await configManager.getApiEnvironments();
            const schemas = await configManager.getLoadedSchemas();
            
            if (environments.length > 0 || schemas.length > 0) {
                // Perform automatic migration without user prompt
                const { DataMigration } = require('./migration/data-migration');
                const migration = new DataMigration(configManager, schemaLoader);
                
                const result = await migration.migrateToSchemaFirst();
                
                if (result.success) {
                    await configManager.setMigrationComplete();
                    console.log(`✅ Auto-migration completed! ${result.schemasCreated} schemas and ${result.environmentsMigrated} environments migrated.`);
                    
                    // Show success notification to user
                    vscode.window.showInformationMessage(
                        `Pathfinder has been upgraded to schema-first architecture! ${result.schemasCreated} schemas and ${result.environmentsMigrated} environments migrated.`
                    );
                } else {
                    console.error('❌ Auto-migration failed:', result.errors);
                    vscode.window.showWarningMessage(
                        `Migration to schema-first architecture failed. Some features may not work correctly. Please check the console for details.`
                    );
                }
            } else {
                // No existing data, just mark migration as complete
                await configManager.setMigrationComplete();
                console.log('✅ No data to migrate, marking migration as complete.');
            }
        } else {
            console.log('✅ Schema-first migration already complete.');
        }
    } catch (error) {
        console.error('❌ Failed to perform auto-migration:', error);
        vscode.window.showErrorMessage(`Failed to migrate extension data: ${error}`);
    }
}

// ========================
// Rename Command Handlers
// ========================

/**
 * Command to rename a schema
 */
async function renameSchemaHandler(schemaOrTreeItem: any) {
    try {
        let schema: any;
        
        // Check if this is a tree item (from context menu) or direct schema object
        if (schemaOrTreeItem?.schema) {
            // It's a tree item from context menu - extract the schema
            schema = schemaOrTreeItem.schema;
        } else if (schemaOrTreeItem?.id && schemaOrTreeItem?.name) {
            // It's a direct schema object
            schema = schemaOrTreeItem;
        } else {
            vscode.window.showErrorMessage('No schema selected for renaming.');
            return;
        }
        
        const newName = await vscode.window.showInputBox({
            prompt: 'Enter new name for the schema',
            value: schema.name,
            validateInput: (value) => {
                if (!value.trim()) {
                    return 'Schema name cannot be empty';
                }
                return null;
            }
        });

        if (!newName || newName.trim() === schema.name) {
            return; // User cancelled or no change
        }

        const updatedSchema = {
            ...schema,
            name: newName.trim(),
            lastUpdated: new Date()
        };

        await configManager.saveApiSchema(updatedSchema);
        treeProvider.refresh();
        await updateWelcomeContext();

        vscode.window.showInformationMessage(`Schema renamed to "${newName}"`);

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to rename schema: ${error}`);
    }
}

/**
 * Command to edit a schema's settings
 */
async function editSchemaHandler(schema: any, context: vscode.ExtensionContext) {
    try {
        console.log('Opening edit schema webview form...');
        
        // Create and show the edit schema webview form
        const { EditSchemaWebview } = await import('./webviews/edit-schema-form.js');
        const editSchemaWebview = new EditSchemaWebview(
            context,
            configManager,
            schema,
            () => {
                // Callback when schema is updated - refresh the tree
                treeProvider.refresh();
            }
        );
        
        await editSchemaWebview.show();
        await updateWelcomeContext();
        
    } catch (error) {
        console.error('Failed to open edit schema form:', error);
        vscode.window.showErrorMessage(`Failed to open edit schema form: ${error}`);
    }
}

/**
 * Command to add environment for a specific schema
 */
async function addEnvironmentForSchemaHandler(schema: any, context: vscode.ExtensionContext) {
    try {
        console.log('Opening add schema environment webview form...');
        
        // Create and show the add schema environment webview form
        const addSchemaEnvironmentWebview = new AddSchemaEnvironmentWebview(
            context,
            configManager,
            schema,
            () => {
                // Callback when environment is added - refresh the tree
                treeProvider.refresh();
            }
        );
        
        await addSchemaEnvironmentWebview.show();
        await updateWelcomeContext();
        
    } catch (error) {
        console.error('Failed to open add schema environment form:', error);
        vscode.window.showErrorMessage(`Failed to open add schema environment form: ${error}`);
    }
}

/**
 * Command to delete a schema and all its environments/groups
 */
async function deleteSchemaHandler(schemaOrTreeItem: any) {
    try {
        let schema: any;
        
        // Check if this is a tree item (from context menu) or direct schema object
        if (schemaOrTreeItem?.schema) {
            // It's a tree item from context menu - extract the schema
            schema = schemaOrTreeItem.schema;
        } else if (schemaOrTreeItem?.id && schemaOrTreeItem?.name) {
            // It's a direct schema object
            schema = schemaOrTreeItem;
        } else {
            vscode.window.showErrorMessage('No schema selected for deletion.');
            return;
        }
        
        const confirm = await vscode.window.showWarningMessage(
            `Delete schema "${schema.name}"?\n\nThis will also delete:\n• All environments using this schema\n• All environment groups in this schema\n\nThis action cannot be undone.`,
            { modal: true },
            'Delete Schema'
        );
        
        if (confirm === 'Delete Schema') {
            // Delete all schema environments first
            const environments = await configManager.getSchemaEnvironments(schema.id);
            for (const env of environments) {
                await configManager.deleteSchemaEnvironment(env.id);
            }
            
            // Delete all schema environment groups
            const groups = await configManager.getSchemaEnvironmentGroups(schema.id);
            for (const group of groups) {
                await configManager.deleteSchemaEnvironmentGroup(group.id);
            }
            
            // Delete the schema itself
            await configManager.deleteApiSchema(schema.id);
            
            treeProvider.refresh();
            await updateWelcomeContext();
            vscode.window.showInformationMessage(`Schema "${schema.name}" and all related data deleted successfully.`);
        }
        
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to delete schema: ${error}`);
    }
}

/**
 * Command to delete a schema environment
 */
async function deleteSchemaEnvironmentHandler(environmentOrTreeItem: any) {
    try {
        let environment: any;
        
        // Check if this is a tree item (from context menu) or direct environment object
        if (environmentOrTreeItem?.environment) {
            // It's a tree item from context menu - extract the environment
            environment = environmentOrTreeItem.environment;
        } else if (environmentOrTreeItem?.id && environmentOrTreeItem?.name) {
            // It's a direct environment object
            environment = environmentOrTreeItem;
        } else {
            vscode.window.showErrorMessage('No environment selected for deletion.');
            return;
        }
        
        const confirm = await vscode.window.showWarningMessage(
            `Delete environment "${environment.name}"?\n\nThis action cannot be undone.`,
            { modal: true },
            'Delete Environment'
        );
        
        if (confirm === 'Delete Environment') {
            await configManager.deleteSchemaEnvironment(environment.id);
            treeProvider.refresh();
            await updateWelcomeContext();
            vscode.window.showInformationMessage(`Environment "${environment.name}" deleted successfully.`);
        }
        
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to delete environment: ${error}`);
    }
}

/**
 * Command to delete a schema environment group and all its environments
 */
async function deleteSchemaEnvironmentGroupHandler(groupOrTreeItem: any) {
    try {
        let group: any;
        
        // Check if this is a tree item (from context menu) or direct group object
        if (groupOrTreeItem?.group) {
            // It's a tree item from context menu - extract the group
            group = groupOrTreeItem.group;
        } else if (groupOrTreeItem?.id && groupOrTreeItem?.name) {
            // It's a direct group object
            group = groupOrTreeItem;
        } else {
            vscode.window.showErrorMessage('No group selected for deletion.');
            return;
        }
        
        // Get environments in this group to show count
        const environments = await configManager.getSchemaEnvironments();
        const groupEnvironments = environments.filter((env: any) => env.environmentGroupId === group.id);
        
        const confirm = await vscode.window.showWarningMessage(
            `Delete environment group "${group.name}"?\n\nThis will also delete ${groupEnvironments.length} environment(s) in this group.\n\nThis action cannot be undone.`,
            { modal: true },
            'Delete Group'
        );
        
        if (confirm === 'Delete Group') {
            // Delete all environments in this group first
            for (const env of groupEnvironments) {
                await configManager.deleteSchemaEnvironment(env.id);
            }
            
            // Delete the group itself
            await configManager.deleteSchemaEnvironmentGroup(group.id);
            
            treeProvider.refresh();
            await updateWelcomeContext();
            vscode.window.showInformationMessage(`Environment group "${group.name}" and ${groupEnvironments.length} environment(s) deleted successfully.`);
        }
        
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to delete environment group: ${error}`);
    }
}

/**
 * Command to change schema color
 */
async function changeSchemaColorHandler(schema: any) {
    try {
        const colorOptions = [
            { label: '🔵 Blue', value: 'blue' },
            { label: '🟢 Green', value: 'green' },
            { label: '🟠 Orange', value: 'orange' },
            { label: '🟣 Purple', value: 'purple' },
            { label: '🔴 Red', value: 'red' },
            { label: '🟡 Yellow', value: 'yellow' }
        ];

        const selectedColor = await vscode.window.showQuickPick(colorOptions, {
            placeHolder: 'Select a color theme for this schema',
            ignoreFocusOut: true
        });

        if (selectedColor) {
            const updatedSchema = {
                ...schema,
                color: selectedColor.value,
                lastUpdated: new Date()
            };

            await configManager.saveApiSchema(updatedSchema);
            treeProvider.refresh();
            await updateWelcomeContext();

            vscode.window.showInformationMessage(`Schema color changed to ${selectedColor.label}`);
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to change schema color: ${error}`);
    }
}

/**
 * Command to change environment group color
 */
async function changeEnvironmentGroupColorHandler(group: any) {
    try {
        const colorOptions = [
            { label: '🔵 Blue', value: 'blue' },
            { label: '🟢 Green', value: 'green' },
            { label: '🟠 Orange', value: 'orange' },
            { label: '🟣 Purple', value: 'purple' },
            { label: '🔴 Red', value: 'red' },
            { label: '🟡 Yellow', value: 'yellow' }
        ];

        const selectedColor = await vscode.window.showQuickPick(colorOptions, {
            placeHolder: 'Select a color theme for this environment group',
            ignoreFocusOut: true
        });

        if (selectedColor) {
            const updatedGroup = {
                ...group,
                color: selectedColor.value
            };

            await configManager.saveSchemaEnvironmentGroup(updatedGroup);
            treeProvider.refresh();
            await updateWelcomeContext();

            vscode.window.showInformationMessage(`Environment group color changed to ${selectedColor.label}`);
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to change environment group color: ${error}`);
    }
}

/**
 * Command to edit an environment using webview form
 */
async function editEnvironmentHandler(environment: SchemaEnvironment, context: vscode.ExtensionContext) {
    try {
        console.log('Opening edit environment webview form...');
        
        // Create and show the edit environment webview form
        const editEnvironmentWebview = new EditEnvironmentWebview(
            context,
            configManager,
            environment,
            () => {
                // Callback when environment is updated - refresh the tree
                treeProvider.refresh();
            }
        );
        
        await editEnvironmentWebview.show();
        await updateWelcomeContext();
        
    } catch (error) {
        console.error('Failed to open edit environment form:', error);
        vscode.window.showErrorMessage(`Failed to open edit environment form: ${error}`);
    }
}

/**
 * Command to rename an environment
 */
async function renameEnvironmentHandler(environmentOrTreeItem: any) {
    try {
        let environment: any;
        
        // Check if this is a tree item (from context menu) or direct environment object
        if (environmentOrTreeItem?.environment) {
            // It's a tree item from context menu - extract the environment
            environment = environmentOrTreeItem.environment;
        } else if (environmentOrTreeItem?.id && environmentOrTreeItem?.name) {
            // It's a direct environment object
            environment = environmentOrTreeItem;
        } else {
            vscode.window.showErrorMessage('No environment selected for renaming.');
            return;
        }
        
        const newName = await vscode.window.showInputBox({
            prompt: 'Enter new name for the environment',
            value: environment.name,
            validateInput: (value) => {
                if (!value.trim()) {
                    return 'Environment name cannot be empty';
                }
                return null;
            }
        });

        if (!newName || newName.trim() === environment.name) {
            return; // User cancelled or no change
        }

        const updatedEnvironment = {
            ...environment,
            name: newName.trim()
        };

        // Check if this is a schema environment or regular environment
        if (environment.schemaId) {
            // It's a schema environment
            await configManager.saveSchemaEnvironment(updatedEnvironment);
        } else {
            // It's a regular API environment
            await configManager.saveApiEnvironment(updatedEnvironment);
        }

        treeProvider.refresh();
        await updateWelcomeContext();

        vscode.window.showInformationMessage(`Environment renamed to "${newName}"`);

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to rename environment: ${error}`);
    }
}

/**
 * Command to rename a group
 */
async function renameGroupHandler(groupOrTreeItem: any) {
    try {
        let group: any;
        
        // Check if this is a tree item (from context menu) or direct group object
        if (groupOrTreeItem?.group) {
            // It's a tree item from context menu - extract the group
            group = groupOrTreeItem.group;
        } else if (groupOrTreeItem?.id && groupOrTreeItem?.name) {
            // It's a direct group object
            group = groupOrTreeItem;
        } else {
            vscode.window.showErrorMessage('No group selected for renaming.');
            return;
        }
        
        const newName = await vscode.window.showInputBox({
            prompt: 'Enter new name for the group',
            value: group.name,
            validateInput: (value) => {
                if (!value.trim()) {
                    return 'Group name cannot be empty';
                }
                return null;
            }
        });

        if (!newName || newName.trim() === group.name) {
            return; // User cancelled or no change
        }

        const updatedGroup = {
            ...group,
            name: newName.trim()
        };

        // Check if this is an environment group or schema-level group
        if (group.color !== undefined) {
            // It has a color property, so it's likely an environment group
            await configManager.saveEnvironmentGroup(updatedGroup);
        } else {
            // It's an environment group managed at schema level
            await configManager.saveApiSchemaGroup(updatedGroup);
        }

        treeProvider.refresh();
        await updateWelcomeContext();

        vscode.window.showInformationMessage(`Group renamed to "${newName}"`);

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to rename group: ${error}`);
    }
}

/**
 * This method is called when your extension is deactivated
 * Use this to clean up any resources
 */
export function deactivate() {
    console.log('👋 Pathfinder - OpenAPI Explorer is shutting down');
}

// Utility to update the welcome context key
async function updateWelcomeContext() {
    try {
        const schemas = await configManager.getApiSchemas();
        const environments = await configManager.getSchemaEnvironments();
        const environmentGroups = await configManager.getSchemaEnvironmentGroups();
        
        // User has data if they have any schemas, environments, or environment groups
        const hasUserData = (schemas && schemas.length > 0) || 
                           (environments && environments.length > 0) || 
                           (environmentGroups && environmentGroups.length > 0);
        
        await vscode.commands.executeCommand('setContext', 'pathfinder.hasUserData', hasUserData);
    } catch (error) {
        console.error('Error updating welcome context:', error);
        // If there's an error, assume no user data to show welcome panel
        await vscode.commands.executeCommand('setContext', 'pathfinder.hasUserData', false);
    }
}
