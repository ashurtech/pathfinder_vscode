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
import { ApiEnvironment, ApiEnvironmentGroup, LoadedSchema, ApiEndpoint } from './types';

/**
 * Main tree data provider that implements VS Code's TreeDataProvider interface
 * This tells VS Code how to build and refresh our tree view
 */
export class ApiTreeProvider implements vscode.TreeDataProvider<TreeItem>, vscode.TreeDragAndDropController<TreeItem> {
    
    // Drag and drop support
    readonly dropMimeTypes = ['application/vnd.code.tree.apitreeprovider'];
    readonly dragMimeTypes = ['application/vnd.code.tree.apitreeprovider'];
    
    // Event emitter for when tree data changes (triggers refresh)
    private readonly _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    
    constructor(
        private readonly configManager: ConfigurationManager,
        private readonly schemaLoader: SchemaLoader
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
     */
    async getChildren(element?: TreeItem): Promise<TreeItem[]> {
        if (!element) {
            // Root level - return groups and ungrouped environments
            return this.getEnvironments();
        }
        
        // Handle different types of tree items
        if (element instanceof EnvironmentGroupTreeItem) {
            return this.getGroupChildren(element);
        } else if (element instanceof EnvironmentTreeItem) {
            return this.getEnvironmentChildren(element);
        } else if (element instanceof SchemaTreeItem) {
            return this.getSchemaChildren(element);
        } else if (element instanceof TagTreeItem) {
            return this.getTagChildren(element);
        } else if (element instanceof EndpointTreeItem) {
            return this.getEndpointChildren(element);
        }
        
        return [];
    }
    
    /**
     * Handle drag operation - what can be dragged
     */
    async handleDrag(source: TreeItem[], treeDataTransfer: vscode.DataTransfer): Promise<void> {
        // Only allow dragging environments
        const draggableItems = source.filter(item => item instanceof EnvironmentTreeItem);
        if (draggableItems.length === 0) {
            return;
        }        // Store the environment IDs for transfer
        const environmentIds = draggableItems.map(item => (item as EnvironmentTreeItem).environment.id);
        treeDataTransfer.set('application/vnd.code.tree.apitreeprovider', 
            new vscode.DataTransferItem(JSON.stringify(environmentIds)));
    }

    /**
     * Handle drop operation - where items can be dropped
     */
    async handleDrop(target: TreeItem | undefined, sources: vscode.DataTransfer): Promise<void> {
        const transferItem = sources.get('application/vnd.code.tree.apitreeprovider');
        if (!transferItem) {
            return;
        }

        const environmentIds: string[] = JSON.parse(transferItem.value);
        
        if (target instanceof EnvironmentGroupTreeItem) {
            // Dropping on a group - move environments to that group
            await this.moveEnvironmentsToGroup(environmentIds, target.group.id);
        } else if (!target || target instanceof ApiTreeProvider) {
            // Dropping on root or empty space - move environments out of groups
            await this.moveEnvironmentsToRoot(environmentIds);
        }
        
        // Refresh the tree after the move
        this.refresh();
    }    /**
     * Move environments to a specific group
     */
    private async moveEnvironmentsToGroup(environmentIds: string[], groupId: string): Promise<void> {
        const group = (await this.configManager.getEnvironmentGroups()).find(g => g.id === groupId);
        if (!group) {
            vscode.window.showErrorMessage('Group not found');
            return;
        }

        // Check schema compatibility if the group has a shared schema
        if (group.sharedSchemaId) {
            // Get loaded schemas for each environment to check compatibility
            const allSchemas = await this.configManager.getLoadedSchemas();
            const environmentsToMove = environmentIds;
            
            const incompatibleEnvs: string[] = [];
            for (const envId of environmentsToMove) {
                const envSchemas = allSchemas.filter(schema => schema.environmentId === envId);
                if (envSchemas.length > 0) {
                    // Check if any loaded schema differs from group's shared schema
                    const hasIncompatibleSchema = envSchemas.some(schema => 
                        schema.source !== group.sharedSchemaId
                    );
                    if (hasIncompatibleSchema) {
                        incompatibleEnvs.push(envId);
                    }
                }
            }
            
            if (incompatibleEnvs.length > 0) {
                const proceed = await vscode.window.showWarningMessage(
                    `${incompatibleEnvs.length} environment(s) have different schemas than the group. Continue anyway?`,
                    'Yes', 'No'
                );
                if (proceed !== 'Yes') {
                    return;
                }
            }
        }

        // Move each environment to the group
        for (const environmentId of environmentIds) {
            await this.configManager.moveEnvironmentToGroup(environmentId, groupId);
        }

        vscode.window.showInformationMessage(
            `Moved ${environmentIds.length} environment(s) to group "${group.name}"`
        );
    }

    /**
     * Move environments out of groups (to root level)
     */
    private async moveEnvironmentsToRoot(environmentIds: string[]): Promise<void> {
        // Move each environment out of its group
        for (const environmentId of environmentIds) {
            await this.configManager.moveEnvironmentToGroup(environmentId);
        }

        vscode.window.showInformationMessage(
            `Moved ${environmentIds.length} environment(s) to root level`
        );
    }
    
    /**
     * Get the root level items: groups and ungrouped environments
     */
    private async getEnvironments(): Promise<TreeItem[]> {
        try {
            const items: TreeItem[] = [];
            
            // Add all environment groups
            const groups = await this.configManager.getEnvironmentGroups();
            items.push(...groups.map(group => new EnvironmentGroupTreeItem(group)));
            
            // Add ungrouped environments
            const ungroupedEnvironments = await this.configManager.getUngroupedEnvironments();
            items.push(...ungroupedEnvironments.map(env => new EnvironmentTreeItem(env)));
            
            if (items.length === 0) {
                // Show helpful messages when nothing exists
                return [
                    new MessageTreeItem(
                        'No environments or groups configured',
                        'Click "Add Environment Group" or "Add API Environment" to get started',
                        'add'
                    )
                ];
            }
            
            return items;
        } catch (error) {
            console.error('Failed to load environments and groups for tree view:', error);
            return [new MessageTreeItem(
                'Error loading environments',
                'Check the console for details',
                'error'
            )];
        }
    }
    
    /**
     * Get children for an environment (load schema action + existing schemas)
     */
    private async getEnvironmentChildren(envItem: EnvironmentTreeItem): Promise<TreeItem[]> {
        try {
            const children: TreeItem[] = [];
            
            // Add "Load Schema" action item as first child
            children.push(new LoadSchemaActionTreeItem(envItem.environment));
            
            // Add environment management actions
            children.push(new EditEnvironmentActionTreeItem(envItem.environment));
            children.push(new DuplicateEnvironmentActionTreeItem(envItem.environment));
            
            // Then add all existing schemas
            const schemas = await this.configManager.getLoadedSchemas(envItem.environment.id);
            
            if (schemas.length === 0) {
                children.push(new MessageTreeItem(
                    'No schemas loaded',
                    'Use "Load Schema" action above to add schemas',
                    'file'
                ));
            } else {
                children.push(...schemas.map(schema => new SchemaTreeItem(schema, envItem.environment)));
            }
            
            return children;
        } catch (error) {
            console.error('Failed to load schemas for environment:', error);
            return [new MessageTreeItem('Error loading schemas', '', 'error')];
        }
    }
    
    /**
     * Get children for a schema (organized by tags, then endpoints)
     */
    private async getSchemaChildren(schemaItem: SchemaTreeItem): Promise<TreeItem[]> {
        try {
            const endpoints = this.schemaLoader.extractEndpoints(schemaItem.schema.schema);
            
            if (endpoints.length === 0) {
                return [new MessageTreeItem('No endpoints found', '', 'info')];
            }
            
            // Group endpoints by tags for better organization
            const tagGroups = this.groupEndpointsByTags(endpoints);
            const treeItems: TreeItem[] = [];
            
            // Add tagged endpoint groups
            for (const [tagName, taggedEndpoints] of tagGroups.entries()) {
                if (tagName !== 'untagged') {
                    treeItems.push(new TagTreeItem(tagName, taggedEndpoints, schemaItem));
                }
            }
            
            // Add untagged endpoints directly (if any)
            const untaggedEndpoints = tagGroups.get('untagged') || [];
            for (const endpoint of untaggedEndpoints) {
                treeItems.push(new EndpointTreeItem(endpoint, schemaItem));
            }
            
            return treeItems;
        } catch (error) {
            console.error('Failed to extract endpoints:', error);
            return [new MessageTreeItem('Error extracting endpoints', '', 'error')];
        }
    }
    
    /**
     * Get children for a tag (the endpoints in that tag)
     */
    private getTagChildren(tagItem: TagTreeItem): TreeItem[] {
        return tagItem.endpoints.map(endpoint => 
            new EndpointTreeItem(endpoint, tagItem.schemaItem)
        );
    }

    /**
     * Get children for an endpoint (action items like "View Details", "Generate cURL", etc.)
     */
    private getEndpointChildren(endpointItem: EndpointTreeItem): TreeItem[] {
        const endpoint = endpointItem.endpoint;
        const schemaItem = endpointItem.schemaItem;
        
        return [
            new EndpointActionTreeItem(
                '📋 View Full Details',
                'Show complete endpoint information',
                'pathfinder.showEndpointDetails',
                'info',
                [endpoint, schemaItem]
            ),
            new EndpointActionTreeItem(
                '💻 Generate cURL',
                'Generate cURL command for this endpoint',
                'pathfinder.generateCurl',
                'terminal',
                [endpoint, schemaItem]
            ),
            new EndpointActionTreeItem(
                '🔧 Generate Ansible',
                'Generate Ansible task for this endpoint',
                'pathfinder.generateAnsible',
                'settings-gear',
                [endpoint, schemaItem]
            ),
            new EndpointActionTreeItem(
                '⚡ Generate PowerShell',
                'Generate PowerShell script for this endpoint',
                'pathfinder.generatePowerShell',
                'terminal-powershell',
                [endpoint, schemaItem]
            ),
            new EndpointActionTreeItem(
                '🐍 Generate Python',
                'Generate Python requests code for this endpoint',
                'pathfinder.generatePython',
                'symbol-method',
                [endpoint, schemaItem]
            ),
            new EndpointActionTreeItem(
                '📜 Generate JavaScript',
                'Generate JavaScript fetch code for this endpoint',
                'pathfinder.generateJavaScript',
                'symbol-function',
                [endpoint, schemaItem]
            ),
            new EndpointActionTreeItem(
                '🧪 Test Endpoint',
                'Execute a test request to this endpoint',
                'pathfinder.testEndpoint',
                'beaker',
                [endpoint, schemaItem]
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

    /**
     * Get children for a group (environments in the group + group management actions)
     */
    private async getGroupChildren(groupItem: EnvironmentGroupTreeItem): Promise<TreeItem[]> {
        try {
            const children: TreeItem[] = [];
            
            // Add group management actions
            children.push(new AddEnvironmentToGroupActionTreeItem(groupItem.group));
            children.push(new EditGroupActionTreeItem(groupItem.group));
            children.push(new GenerateMultiEnvironmentCodeActionTreeItem(groupItem.group));
            
            // Add environments in this group
            const environmentsInGroup = await this.configManager.getEnvironmentsInGroup(groupItem.group.id);
            
            if (environmentsInGroup.length === 0) {
                children.push(new MessageTreeItem(
                    'No environments in group',
                    'Drag environments here or use "Add Environment to Group"',
                    'folder'
                ));
            } else {
                children.push(...environmentsInGroup.map(env => new EnvironmentTreeItem(env)));
            }
            
            return children;
        } catch (error) {
            console.error('Failed to load group children:', error);
            return [new MessageTreeItem('Error loading group', '', 'error')];
        }
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
 * Tree item representing an environment group
 */
class EnvironmentGroupTreeItem extends TreeItem {
    constructor(public readonly group: ApiEnvironmentGroup) {
        super(group.name, vscode.TreeItemCollapsibleState.Collapsed);
        
        // Set icon with color theme
        const iconColor = group.color ?? 'blue';
        this.iconPath = new vscode.ThemeIcon('folder', new vscode.ThemeColor(`charts.${iconColor}`));
        this.tooltip = `${group.name}\n${group.description ?? 'No description'}\nCreated: ${group.createdAt.toLocaleString()}`;
        this.description = group.description;
        
        // Enable drag and drop
        this.contextValue = 'environmentGroup';
        
        // Command to run when clicked
        this.command = {
            command: 'pathfinder.showGroupDetails',
            title: 'Show Group Details',
            arguments: [group]
        };
    }
}

/**
 * Tree item representing an API environment
 */
class EnvironmentTreeItem extends TreeItem {
    constructor(public readonly environment: ApiEnvironment) {
        super(environment.name, vscode.TreeItemCollapsibleState.Collapsed);
        
        // Set icon and context for the environment
        this.iconPath = new vscode.ThemeIcon('server-environment');
        this.tooltip = `${environment.name}\n${environment.baseUrl}\nAuth: ${environment.auth.type}`;
        this.description = environment.baseUrl;
        
        // Context value enables context menu items and drag/drop
        this.contextValue = environment.groupId ? 'environment-grouped' : 'environment';
        
        // Enable drag and drop
        this.resourceUri = vscode.Uri.parse(`pathfinder://environment/${environment.id}`);
        
        // Command to run when clicked (optional - shows environment details)
        this.command = {
            command: 'pathfinder.showEnvironmentDetails',
            title: 'Show Environment Details',
            arguments: [environment]
        };
    }
}

/**
 * Tree item representing a loaded OpenAPI schema
 */
class SchemaTreeItem extends TreeItem {
    constructor(
        public readonly schema: LoadedSchema,
        public readonly environment: ApiEnvironment
    ) {
        const info = new SchemaLoader().getSchemaInfo(schema.schema);
        super(`${info.title} v${info.version}`, vscode.TreeItemCollapsibleState.Collapsed);
        
        // Set icon based on schema validity
        this.iconPath = new vscode.ThemeIcon(schema.isValid ? 'file-code' : 'error');
        this.tooltip = `${info.title} v${info.version}\n${info.endpointCount} endpoints\nLoaded: ${schema.loadedAt.toLocaleString()}`;
        this.description = `${info.endpointCount} endpoints`;
        
        this.contextValue = 'schema';
        
        // Command to show schema details when clicked
        this.command = {
            command: 'pathfinder.showSchemaDetails',
            title: 'Show Schema Details',
            arguments: [schema]
        };
    }
}

/**
 * Tree item representing a group of endpoints with the same tag
 */
class TagTreeItem extends TreeItem {
    constructor(
        public readonly tag: string,
        public readonly endpoints: ApiEndpoint[],
        public readonly schemaItem: SchemaTreeItem
    ) {
        super(tag, vscode.TreeItemCollapsibleState.Collapsed);
        
        this.iconPath = new vscode.ThemeIcon('tag');
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
        public readonly schemaItem: SchemaTreeItem
    ) {
        const label = `${endpoint.method} ${endpoint.path}`;
        super(label, vscode.TreeItemCollapsibleState.Collapsed); // Changed to Collapsed
        
        // Set icon based on HTTP method
        this.iconPath = this.getMethodIcon(endpoint.method);
        this.tooltip = `${endpoint.method} ${endpoint.path}\n${endpoint.summary ?? 'No description'}\n\nClick to expand actions`;
        this.description = endpoint.summary;
        this.contextValue = 'endpoint';
        
        // Remove the command - let users expand the tree instead
        // this.command = { ... };
    }
    
    /**
     * Get appropriate icon for HTTP method
     */
    private getMethodIcon(method: string): vscode.ThemeIcon {
        const iconMap: { [key: string]: string } = {
            'GET': 'arrow-down',
            'POST': 'add',
            'PUT': 'edit',
            'DELETE': 'trash',
            'PATCH': 'gear',
            'HEAD': 'eye',
            'OPTIONS': 'question'
        };
        
        return new vscode.ThemeIcon(iconMap[method] ?? 'circle-outline');
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
        
        this.iconPath = new vscode.ThemeIcon(iconName);
        this.tooltip = actionTooltip;
        this.contextValue = 'endpointAction';
        
        // Command to run when clicked
        this.command = {
            command: commandId,
            title: actionLabel,
            arguments: commandArgs
        };
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
 * Tree item for "Load Schema" action under environments
 */
class LoadSchemaActionTreeItem extends TreeItem {
    constructor(public readonly environment: ApiEnvironment) {
        super('📂 Load Schema...', vscode.TreeItemCollapsibleState.None);
        
        this.iconPath = new vscode.ThemeIcon('add');
        this.tooltip = 'Load a new OpenAPI schema into this environment';
        this.contextValue = 'loadSchemaAction';
        
        // Show submenu when clicked
        this.command = {
            command: 'pathfinder.showLoadSchemaOptions',
            title: 'Load Schema Options',
            arguments: [environment]
        };
    }
}

/**
 * Tree item for "Edit Environment" action
 */
class EditEnvironmentActionTreeItem extends TreeItem {
    constructor(public readonly environment: ApiEnvironment) {
        super('✏️ Edit Environment', vscode.TreeItemCollapsibleState.None);
        
        this.iconPath = new vscode.ThemeIcon('edit');
        this.tooltip = 'Edit this environment\'s settings';
        this.contextValue = 'editEnvironmentAction';
        
        this.command = {
            command: 'pathfinder.editEnvironment',
            title: 'Edit Environment',
            arguments: [environment]
        };
    }
}

/**
 * Tree item for "Duplicate Environment" action
 */
class DuplicateEnvironmentActionTreeItem extends TreeItem {
    constructor(public readonly environment: ApiEnvironment) {
        super('📋 Duplicate Environment', vscode.TreeItemCollapsibleState.None);
        
        this.iconPath = new vscode.ThemeIcon('copy');
        this.tooltip = 'Create a copy of this environment';
        this.contextValue = 'duplicateEnvironmentAction';
        
        this.command = {
            command: 'pathfinder.duplicateEnvironment',
            title: 'Duplicate Environment',
            arguments: [environment]
        };
    }
}

/**
 * Tree item for "Add Environment to Group" action
 */
class AddEnvironmentToGroupActionTreeItem extends TreeItem {
    constructor(public readonly group: ApiEnvironmentGroup) {
        super('➕ Add Environment to Group', vscode.TreeItemCollapsibleState.None);
        
        this.iconPath = new vscode.ThemeIcon('add');
        this.tooltip = 'Add an existing environment to this group';
        this.contextValue = 'addEnvironmentToGroupAction';
        
        this.command = {
            command: 'pathfinder.addEnvironmentToGroup',
            title: 'Add Environment to Group',
            arguments: [group]
        };
    }
}

/**
 * Tree item for "Edit Group" action
 */
class EditGroupActionTreeItem extends TreeItem {
    constructor(public readonly group: ApiEnvironmentGroup) {
        super('✏️ Edit Group', vscode.TreeItemCollapsibleState.None);
        
        this.iconPath = new vscode.ThemeIcon('edit');
        this.tooltip = 'Edit this group\'s settings';
        this.contextValue = 'editGroupAction';
        
        this.command = {
            command: 'pathfinder.editGroup',
            title: 'Edit Group',
            arguments: [group]
        };
    }
}

/**
 * Tree item for "Generate Multi-Environment Code" action
 */
class GenerateMultiEnvironmentCodeActionTreeItem extends TreeItem {
    constructor(public readonly group: ApiEnvironmentGroup) {
        super('🚀 Generate Code for All Environments', vscode.TreeItemCollapsibleState.None);
        
        this.iconPath = new vscode.ThemeIcon('rocket');
        this.tooltip = 'Generate commands for all environments in this group';
        this.contextValue = 'generateMultiEnvironmentCodeAction';
        
        this.command = {
            command: 'pathfinder.generateMultiEnvironmentCode',
            title: 'Generate Multi-Environment Code',
            arguments: [group]
        };
    }
}
