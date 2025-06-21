/**
 * Tree View Provider for API Helper Extension
 * 
 * This file implements the tree view that shows API environments, schemas, and endpoints
 * in VS Code's Explorer panel. Think of it as creating a file explorer, but for APIs!
 * 
 * Key VS Code Concepts:
 * - TreeDataProvider: Interface that tells VS Code how to build the tree
 * - TreeItem: Individual nodes in the tree (folders, files, etc.)
 * - Commands: Actions that can be triggered when clicking tree items
 */

import * as vscode from 'vscode';
import { ConfigurationManager } from './configuration';
import { SchemaLoader } from './schema-loader';
import { 
    ApiEndpoint,
    ApiSchema,
    SchemaEnvironment,
    ApiSchemaGroup
} from './types';

/**
 * Type alias for tree data change event
 */
type TreeDataChangeEvent = TreeItem | undefined | null | void;

/**
 * Main tree data provider that implements VS Code's TreeDataProvider interface
 * This tells VS Code how to build and refresh our tree view
 */
export class ApiTreeProvider implements vscode.TreeDataProvider<TreeItem>, vscode.TreeDragAndDropController<TreeItem> {
    
    // Drag and drop support
    readonly dropMimeTypes = ['application/vnd.code.tree.apitreeprovider'];
    readonly dragMimeTypes = ['application/vnd.code.tree.apitreeprovider'];
    
    // Event emitter for when tree data changes (triggers refresh)
    private readonly _onDidChangeTreeData: vscode.EventEmitter<TreeDataChangeEvent> = new vscode.EventEmitter<TreeDataChangeEvent>();
    readonly onDidChangeTreeData: vscode.Event<TreeDataChangeEvent> = this._onDidChangeTreeData.event;
      constructor(
        private readonly configManager: ConfigurationManager,
        private readonly schemaLoader: SchemaLoader,
        private readonly notebookController?: any // NotebookController - avoiding circular import
    ) {}
    
    /**
     * Refresh the entire tree view
     * Call this when environments or schemas change
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
    
    /**
     * Get the tree item representation of an element
     * This is called by VS Code to render each node
     */
    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }
      /**
     * Get the children of a tree element
     * This is the core method that builds the tree structure
     * Now uses only schema-first architecture (migration is forced on startup)
     */
    async getChildren(element?: TreeItem): Promise<TreeItem[]> {
        if (!element) {
            // Root level - use schema-first architecture only
            return this.getSchemas();
        }        // Handle schema-first tree items only
        if (element instanceof ApiSchemaTreeItem) {
            return this.getApiSchemaChildren(element);
        } else if (element instanceof SchemaGroupTreeItem) {
            return this.getSchemaGroupChildren(element);
        } else if (element instanceof SchemaEnvironmentTreeItem) {
            return this.getSchemaEnvironmentChildren(element);
        } else if (element instanceof SchemaEnvironmentGroupTreeItem) {
            return this.getSchemaEnvironmentGroupChildren(element);
        } else if (element instanceof TagTreeItem) {
            return this.getTagChildren(element);
        } else if (element instanceof EndpointTreeItem) {
            return this.getEndpointChildren(element);
        } else if (element instanceof GenerateCommandsFolderTreeItem) {
            return this.getGenerateCommandsChildren(element);
        }
        
        return [];
    }
      /**
     * Handle drag operation - what can be dragged
     */
    handleDrag(source: readonly TreeItem[], treeDataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void | Thenable<void> {
        // Only allow dragging SchemaEnvironmentTreeItems
        const environments = source.filter(item => item instanceof SchemaEnvironmentTreeItem) as SchemaEnvironmentTreeItem[];
        if (environments.length === 0) {
            return;
        }

        // Add the environments to the transfer
        treeDataTransfer.set('application/vnd.code.tree.apiExplorer', new vscode.DataTransferItem(environments));
    }
    /**
     * Handle drop operation - where items can be dropped
     */
    async handleDrop(target: TreeItem | undefined, sources: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
        const transferItem = sources.get('application/vnd.code.tree.apiExplorer');
        if (!transferItem) {
            return;
        }

        const environments = transferItem.value as SchemaEnvironmentTreeItem[];
        if (!environments) {
            return;
        }

        // If target is a group, add environments to it
        if (target instanceof SchemaEnvironmentGroupTreeItem) {
            for (const env of environments) {
                env.environment.environmentGroupId = target.group.id;
                await this.configManager.saveSchemaEnvironment(env.environment);
            }
        } else {
            // If dropped at root level, remove from group
            for (const env of environments) {
                env.environment.environmentGroupId = undefined;
                await this.configManager.saveSchemaEnvironment(env.environment);
            }
        }

        this.refresh();
    }
    /**
     * Get the root level items for schema-first architecture: all schemas at top level
     */    private async getSchemas(): Promise<TreeItem[]> {
        try {
            const items: TreeItem[] = [];
            
            // Get all schemas (both grouped and ungrouped) and show them at the top level
            const allSchemas = await this.configManager.getApiSchemas();
            items.push(...allSchemas.map((schema: ApiSchema) => new ApiSchemaTreeItem(schema, this.schemaLoader)));
            
            if (items.length === 0) {
                // Return empty array to allow VS Code's viewsWelcome to show
                // The welcome panel is configured in package.json with "when": "!pathfinder.hasUserData"
                return [];
            }
            
            return items;
        } catch (error) {
            console.error('Failed to load schemas for tree view:', error);
            return [new MessageTreeItem(
                'Error loading schemas',
                'Check the console for details',
                'error'
            )];
        }
    }
      /**
     * Get children for an environment group
     */
    private async getSchemaGroupChildren(groupItem: SchemaGroupTreeItem): Promise<TreeItem[]> {
        try {
            const schemas = await this.configManager.getApiSchemasByGroup(groupItem.group.id);
            const children: TreeItem[] = [];
            
            if (schemas.length === 0) {
                children.push(new MessageTreeItem(
                    'No schemas in this group',
                    'Add schemas to this group',
                    'file'
                ));
            } else {
                children.push(...schemas.map((schema: ApiSchema) => new ApiSchemaTreeItem(schema, this.schemaLoader)));
            }
            
            return children;
        } catch (error) {
            console.error('Failed to load schemas for group:', error);
            return [new MessageTreeItem('Error loading schemas', '', 'error')];
        }
    }
      /**
     * Get children for an API schema (environments using this schema + management actions)
     */
    private async getApiSchemaChildren(schemaItem: ApiSchemaTreeItem): Promise<TreeItem[]> {
        try {
            const children: TreeItem[] = [];            // Add schema management actions first
            children.push(new EnvironmentActionTreeItem(
                'Add Environment',
                'Create a new environment using this schema',
                'pathfinder.addEnvironmentForSchema',
                'add',
                [schemaItem.schema]
            ));
            
            children.push(new EnvironmentActionTreeItem(
                'Add Environment Group',
                'Create a new environment group within this schema',
                'pathfinder.addSchemaEnvironmentGroup',
                'folder-opened',
                [schemaItem.schema]
            ));
            
            children.push(new EnvironmentActionTreeItem(
                'Edit Schema',
                'Edit this schema\'s settings',
                'pathfinder.editSchema',
                'edit',
                [schemaItem.schema]
            ));
              // Get environment groups for this schema
            const environmentGroups = await this.configManager.getSchemaEnvironmentGroups(schemaItem.schema.id);
            
            // Get environments using this schema
            const environments = await this.configManager.getSchemaEnvironments(schemaItem.schema.id);
            
            if (environmentGroups.length === 0 && environments.length === 0) {
                children.push(new MessageTreeItem(
                    'No environments or groups',
                    'Use "Add Environment" or "Add Environment Group" above',
                    'server-environment'
                ));
            } else {
                // Add environment groups first
                children.push(...environmentGroups.map((group: any) => new SchemaEnvironmentGroupTreeItem(group, schemaItem)));
                
                // Add ungrouped environments 
                const ungroupedEnvironments = environments.filter((env: any) => !env.environmentGroupId);
                children.push(...ungroupedEnvironments.map((env: any) => new SchemaEnvironmentTreeItem(env, schemaItem)));
            }
            
            return children;
        } catch (error) {
            console.error('Failed to load environments for schema:', error);
            return [new MessageTreeItem('Error loading environments', '', 'error')];
        }
    }    /**
     * Get children for a schema environment group (environments in this group)
     */
    private async getSchemaEnvironmentGroupChildren(groupItem: SchemaEnvironmentGroupTreeItem): Promise<TreeItem[]> {
        try {
            const children: TreeItem[] = [];
            
            // Add group management actions
            children.push(new EnvironmentActionTreeItem(
                'Add Environment to Group',
                'Create a new environment in this group',
                'pathfinder.addEnvironmentToGroup',
                'add',
                [groupItem.group, groupItem.schemaItem.schema]
            ));
            
            children.push(new EnvironmentActionTreeItem(
                'Edit Group',
                'Edit this environment group\'s settings',
                'pathfinder.editEnvironmentGroup',
                'edit',
                [groupItem.group]
            ));
            
            // Get environments in this group
            const allEnvironments = await this.configManager.getSchemaEnvironments(groupItem.schemaItem.schema.id);
            const groupEnvironments = allEnvironments.filter((env: any) => env.environmentGroupId === groupItem.group.id);
            
            if (groupEnvironments.length === 0) {
                children.push(new MessageTreeItem(
                    'No environments in this group',
                    'Use "Add Environment to Group" above',
                    'server-environment'
                ));
            } else {
                children.push(...groupEnvironments.map((env: any) => new SchemaEnvironmentTreeItem(env, groupItem.schemaItem)));
            }
            
            return children;
        } catch (error) {
            console.error('Failed to load children for schema environment group:', error);
            return [new MessageTreeItem('Error loading group contents', '', 'error')];
        }
    }
    
    /**
     * Get children for a schema environment (endpoints/actions)
     */
    private async getSchemaEnvironmentChildren(envItem: SchemaEnvironmentTreeItem): Promise<TreeItem[]> {
        try {
            const children: TreeItem[] = [];
            
            // Add environment management actions
            children.push(new EnvironmentActionTreeItem(
                'Edit Environment',
                'Edit this environment\'s settings',
                'pathfinder.editEnvironment',
                'edit',
                [envItem.environment]
            ));
            children.push(new EnvironmentActionTreeItem(
                'Duplicate Environment',
                'Create a copy of this environment',
                'pathfinder.duplicateEnvironment',
                'copy',
                [envItem.environment]
            ));
            
            // Add schema endpoints organized by tags
            const endpoints = this.schemaLoader.extractEndpoints(envItem.schemaItem.schema.schema);
            
            if (endpoints.length === 0) {
                children.push(new MessageTreeItem('No endpoints found', '', 'info'));
            } else {
                // Group endpoints by tags for better organization
                const tagGroups = this.groupEndpointsByTags(endpoints);
                
                // Add tagged endpoint groups
                for (const [tagName, taggedEndpoints] of tagGroups.entries()) {
                    if (tagName !== 'untagged') {
                        children.push(new TagTreeItem(tagName, taggedEndpoints, envItem.schemaItem, envItem.environment));
                    }
                }
                
                // Add untagged endpoints directly (if any)
                const untaggedEndpoints = tagGroups.get('untagged') || [];
                for (const endpoint of untaggedEndpoints) {
                    children.push(new EndpointTreeItem(endpoint, envItem.schemaItem, envItem.environment));
                }
            }
            
            return children;
        } catch (error) {
            console.error('Failed to load children for schema environment:', error);
            return [new MessageTreeItem('Error loading content', '', 'error')];
        }
    }
  
  
    
    /**
     * Get children for a tag (the endpoints in that tag)
     */
    private getTagChildren(tagItem: TagTreeItem): TreeItem[] {
        return tagItem.endpoints.map(endpoint => 
            new EndpointTreeItem(endpoint, tagItem.schemaItem, tagItem.environment)
        );
    }    /**
     * Get children for an endpoint (action items like "View Details", "Generate cURL", etc.)
     */    private getEndpointChildren(endpointItem: EndpointTreeItem): TreeItem[] {
        const endpoint = endpointItem.endpoint;
        const schemaItem = endpointItem.schemaItem;
        const environment = endpointItem.environment;
        
        return [
            new EndpointActionTreeItem(
                '📋 View Full Details',
                'Show complete endpoint information',
                'pathfinder.showEndpointDetails',
                'info',
                [endpoint, schemaItem, environment]
            ),
            new GenerateCommandsFolderTreeItem(endpoint, schemaItem, environment),
            new EndpointActionTreeItem(
                '🚀 Run HTTP Request',
                'Open HTTP request editor for this endpoint',
                'pathfinder.runHttpRequest',
                'play',
                [endpoint, schemaItem, environment]
            ),
            new EndpointActionTreeItem(
                '📓 Run in Request Notebook',
                'Open this endpoint in an interactive notebook editor',
                'pathfinder.runInNotebook',
                'notebook',
                [endpoint, schemaItem.schema.id, environment.id]
            )
        ];
    }    /**
     * Get children for the generate commands folder
     */
    private getGenerateCommandsChildren(folderItem: GenerateCommandsFolderTreeItem): TreeItem[] {
        const endpoint = folderItem.endpoint;
        const schemaItem = folderItem.schemaItem;
        const environment = folderItem.environment;
        
        // Create a combined object that includes environment information for the snippet generators
        const schemaItemWithEnvironment = {
            ...schemaItem,
            environment: environment,
            schema: schemaItem.schema
        };
        
        return [
            new EndpointActionTreeItem(
                '💻 Generate cURL',
                'Generate cURL command for this endpoint',
                'pathfinder.generateCurl',
                'terminal',
                [endpoint, schemaItemWithEnvironment]
            ),
            new EndpointActionTreeItem(
                '🔧 Generate Ansible',
                'Generate Ansible task for this endpoint',
                'pathfinder.generateAnsible',
                'settings-gear',
                [endpoint, schemaItemWithEnvironment]
            ),
            new EndpointActionTreeItem(
                '⚡ Generate PowerShell',
                'Generate PowerShell script for this endpoint',
                'pathfinder.generatePowerShell',
                'terminal-powershell',
                [endpoint, schemaItemWithEnvironment]
            ),
            new EndpointActionTreeItem(
                '🐍 Generate Python',
                'Generate Python requests code for this endpoint',
                'pathfinder.generatePython',
                'symbol-method',
                [endpoint, schemaItemWithEnvironment]
            ),
            new EndpointActionTreeItem(
                '📜 Generate JavaScript',
                'Generate JavaScript fetch code for this endpoint',
                'pathfinder.generateJavaScript',
                'symbol-function',
                [endpoint, schemaItemWithEnvironment]
            )
        ];
    }
    
    /**
     * Group endpoints by their tags for better organization
     */
    private groupEndpointsByTags(endpoints: ApiEndpoint[]): Map<string, ApiEndpoint[]> {
        const groups = new Map<string, ApiEndpoint[]>();
        
        for (const endpoint of endpoints) {
            const tags = endpoint.tags && endpoint.tags.length > 0 ? endpoint.tags : ['untagged'];
            
            for (const tag of tags) {
                if (!groups.has(tag)) {
                    groups.set(tag, []);
                }
                groups.get(tag)!.push(endpoint);
            }
        }
        
        return groups;
    }
}

/**
 * Base class for all tree items
 */
export abstract class TreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
    }
}







/**
 * Tree item representing a group of endpoints with the same tag
 */
class TagTreeItem extends TreeItem {
    constructor(
        public readonly tag: string,
        public readonly endpoints: ApiEndpoint[],
        public readonly schemaItem: ApiSchemaTreeItem,
        public readonly environment: SchemaEnvironment
    ) {
        super(tag, vscode.TreeItemCollapsibleState.Collapsed);
        // Use colored tag icon
        this.iconPath = new vscode.ThemeIcon('tag', new vscode.ThemeColor('charts.orange'));
        this.tooltip = `Tag: ${tag}\n${endpoints.length} endpoints`;
        this.description = `${endpoints.length} endpoints`;
        this.contextValue = 'tag';
    }
}

/**
 * Tree item representing a single API endpoint
 */
class EndpointTreeItem extends TreeItem {
    constructor(
        public readonly endpoint: ApiEndpoint,
        public readonly schemaItem: ApiSchemaTreeItem,
        public readonly environment: SchemaEnvironment
    ) {
        // Compose a standout label: method, path, and all-caps method
        const method = endpoint.method.toUpperCase();
        const label = `[${method}] ${endpoint.path}`;
        super(label, vscode.TreeItemCollapsibleState.Collapsed);

        // Set icon and color based on HTTP method (colored ThemeIcon only)
        this.iconPath = EndpointTreeItem.getMethodIcon(method);
        this.tooltip = `${method} ${endpoint.path}\n${endpoint.summary ?? 'No description'}\n\nClick to expand actions`;
        this.description = endpoint.summary;
        this.contextValue = 'endpoint';
    }

    // Use a colored icon for each HTTP method
    private static getMethodIcon(method: string): vscode.ThemeIcon {
        const colorMap: { [key: string]: string } = {
            'GET': 'charts.green',
            'POST': 'charts.blue',
            'PUT': 'charts.yellow',
            'DELETE': 'charts.red',
            'PATCH': 'charts.purple',
            'HEAD': 'charts.orange',
            'OPTIONS': 'charts.gray'
        };
        const iconMap: { [key: string]: string } = {
            'GET': 'arrow-down',
            'POST': 'add',
            'PUT': 'edit',
            'DELETE': 'trash',
            'PATCH': 'gear',
            'HEAD': 'eye',
            'OPTIONS': 'question'
        };
        return new vscode.ThemeIcon(iconMap[method] ?? 'circle-outline', new vscode.ThemeColor(colorMap[method] ?? 'foreground'));
    }
}

/**
 * Tree item representing an action that can be performed on an endpoint
 */
class EndpointActionTreeItem extends TreeItem {
    constructor(
        public readonly actionLabel: string,
        public readonly actionTooltip: string,
        public readonly commandId: string,
        public readonly iconName: string,
        public readonly commandArgs: any[]
    ) {
        super(actionLabel, vscode.TreeItemCollapsibleState.None);
        // Use colored ThemeIcon if available
        this.iconPath = EndpointActionTreeItem.getColoredIcon(iconName);
        this.tooltip = actionTooltip;
        this.contextValue = 'endpointAction';
        this.command = {
            command: commandId,
            title: actionLabel,
            arguments: commandArgs
        };
    }
    private static getColoredIcon(iconName: string): vscode.ThemeIcon {
        // Map to colored theme icons for common actions
        const colorMap: { [key: string]: string } = {
            'info': 'charts.blue',
            'terminal': 'charts.green',
            'settings-gear': 'charts.yellow',
            'terminal-powershell': 'charts.purple',
            'symbol-method': 'charts.orange',
            'symbol-function': 'charts.gray',
            'play': 'charts.green',
            'add': 'charts.blue',
            'edit': 'charts.yellow',
            'trash': 'charts.red',
            'copy': 'charts.purple',
            'folder': 'charts.yellow',
            'rocket': 'charts.green',
            'tag': 'charts.orange',
            'eye': 'charts.cyan',
            'question': 'charts.gray'
        };
        return new vscode.ThemeIcon(iconName, new vscode.ThemeColor(colorMap[iconName] ?? 'foreground'));
    }
}

/**
 * Tree item representing a folder of code generation commands
 */
class GenerateCommandsFolderTreeItem extends TreeItem {
    constructor(
        public readonly endpoint: ApiEndpoint,
        public readonly schemaItem: ApiSchemaTreeItem,
        public readonly environment: SchemaEnvironment
    ) {
        super('Generate commands >', vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode.ThemeIcon('symbol-method');
        this.tooltip = 'Generate code for this endpoint';
        this.contextValue = 'generateCommandsFolder';
    }
}

/**
 * Tree item for showing messages (errors, empty states, etc.)
 */
class MessageTreeItem extends TreeItem {
    constructor(
        message: string,
        tooltip: string = '',
        iconName: string = 'info'
    ) {
        super(message, vscode.TreeItemCollapsibleState.None);
        
        this.iconPath = new vscode.ThemeIcon(iconName);
        this.tooltip = tooltip;
        this.contextValue = 'message';
        
        // Gray out message items
        this.resourceUri = vscode.Uri.parse('untitled:message');
    }
}













/**
 * Tree item representing an API schema
 */
class ApiSchemaTreeItem extends TreeItem {
    constructor(public readonly schema: ApiSchema, private readonly schemaLoader?: SchemaLoader) {
        super(schema.name, vscode.TreeItemCollapsibleState.Collapsed);
        
        // Calculate endpoint count dynamically
        let endpointCount = 0;
        if (this.schemaLoader) {
            try {
                const endpoints = this.schemaLoader.extractEndpoints(schema.schema);
                endpointCount = endpoints.length;
            } catch (error) {
                console.warn('Failed to extract endpoints for schema:', error);
            }        }
        
        const iconColor = schema.color ?? 'blue';
        this.iconPath = new vscode.ThemeIcon('file-code', new vscode.ThemeColor(`charts.${iconColor}`));
        this.tooltip = `${schema.name}\nVersion: ${schema.version}\nEndpoints: ${endpointCount}`;
        this.description = `v${schema.version}`;
        this.contextValue = 'apiSchema';
    }
}

/**
 * Tree item representing an environment group
 */
class SchemaGroupTreeItem extends TreeItem {
    constructor(public readonly group: ApiSchemaGroup) {
        super(group.name, vscode.TreeItemCollapsibleState.Collapsed);
        
        this.iconPath = new vscode.ThemeIcon('folder', new vscode.ThemeColor('charts.yellow'));
        this.tooltip = `${group.name}\n${group.description ?? 'No description'}`;
        this.description = group.description;
        this.contextValue = 'schemaGroup';
    }
}

/**
 * Tree item representing an environment using a schema
 */
class SchemaEnvironmentTreeItem extends TreeItem {
    constructor(
        public readonly environment: SchemaEnvironment,
        public readonly schemaItem: ApiSchemaTreeItem    ) {
        super(environment.name, vscode.TreeItemCollapsibleState.Collapsed);
        
        // Inherit color from parent schema, with fallback
        const iconColor = schemaItem.schema.color ?? 'blue';
        this.iconPath = new vscode.ThemeIcon('server-environment', new vscode.ThemeColor(`charts.${iconColor}`));
        this.tooltip = `${environment.name}\nBase URL: ${environment.baseUrl}`;
        this.description = environment.baseUrl;
        this.contextValue = 'schemaEnvironment';
    }
}

/**
 * Tree item representing an environment group within a schema
 */
class SchemaEnvironmentGroupTreeItem extends TreeItem {
    constructor(
        public readonly group: any,
        public readonly schemaItem: ApiSchemaTreeItem
    ) {
        super(group.name, vscode.TreeItemCollapsibleState.Collapsed);
        
        const iconColor = group.color ?? 'yellow';
        this.iconPath = new vscode.ThemeIcon('folder', new vscode.ThemeColor(`charts.${iconColor}`));
        
        // Build tooltip with authentication info
        let tooltip = `${group.name}\n${group.description ?? 'No description'}`;
        if (group.defaultAuth?.type && group.defaultAuth.type !== 'none') {
            tooltip += `\n🔐 Default Auth: ${group.defaultAuth.type.toUpperCase()}`;
        }
        
        this.tooltip = tooltip;
          // Add auth indicator to description
        let description = group.description;
        if (group.defaultAuth?.type && group.defaultAuth.type !== 'none') {
            let authIcon = '🔐';
            if (group.defaultAuth.type === 'apikey') {
                authIcon = '🔑';
            } else if (group.defaultAuth.type === 'bearer') {
                authIcon = '🎫';
            } else if (group.defaultAuth.type === 'basic') {
                authIcon = '👤';
            }
            description = description ? `${authIcon} ${description}` : `${authIcon} Auth configured`;
        }
        this.description = description;
        
        this.contextValue = 'schemaEnvironmentGroup';
    }
}

/**
 * Tree item representing an action that can be performed on an environment
 */
class EnvironmentActionTreeItem extends TreeItem {
    constructor(
        public readonly actionLabel: string,
        public readonly actionTooltip: string,
        public readonly commandId: string,
        public readonly iconName: string,
        public readonly commandArgs: any[]
    ) {
        super(actionLabel, vscode.TreeItemCollapsibleState.None);
        
        this.iconPath = new vscode.ThemeIcon(iconName, new vscode.ThemeColor('charts.orange'));
        this.tooltip = actionTooltip;
        this.contextValue = 'environmentAction';
        this.command = {
            command: commandId,
            title: actionLabel,
            arguments: commandArgs
        };
    }
}

/**
 * Tree item for "Add Schema to Group" action
 */
class AddSchemaToGroupActionTreeItem extends TreeItem {
    constructor(public readonly group: ApiSchemaGroup) {
        super('➕ Add Schema to Group', vscode.TreeItemCollapsibleState.None);
        
        this.iconPath = new vscode.ThemeIcon('add');
        this.tooltip = 'Add an existing schema to this group';
        this.contextValue = 'addSchemaToGroupAction';
        
        this.command = {
            command: 'pathfinder.addSchemaToGroup',
            title: 'Add Schema to Group',
            arguments: [group]
        };
    }
}

/**
 * Tree item for "Edit Environment Group" action
 */
class EditSchemaGroupActionTreeItem extends TreeItem {
    constructor(public readonly group: ApiSchemaGroup) {
        super('✏️ Edit Environment Group', vscode.TreeItemCollapsibleState.None);
        
        this.iconPath = new vscode.ThemeIcon('edit');
        this.tooltip = 'Edit this environment group\'s settings';
        this.contextValue = 'editSchemaGroupAction';
        
        this.command = {
            command: 'pathfinder.editSchemaGroup',
            title: 'Edit Environment Group',
            arguments: [group]        };
    }
}
