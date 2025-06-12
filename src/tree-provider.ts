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
import { ApiEnvironment, LoadedSchema, ApiEndpoint } from './types';

/**
 * Main tree data provider that implements VS Code's TreeDataProvider interface
 * This tells VS Code how to build and refresh our tree view
 */
export class ApiTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    
    // Event emitter for when tree data changes (triggers refresh)
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    
    constructor(
        private configManager: ConfigurationManager,
        private schemaLoader: SchemaLoader
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
            // Root level - return all environments
            return this.getEnvironments();
        }
        
        // Handle different types of tree items
        if (element instanceof EnvironmentTreeItem) {
            return this.getEnvironmentChildren(element);
        } else if (element instanceof SchemaTreeItem) {
            return this.getSchemaChildren(element);
        } else if (element instanceof TagTreeItem) {
            return this.getTagChildren(element);
        }
        
        return [];
    }
    
    /**
     * Get all API environments as tree items
     */
    private async getEnvironments(): Promise<TreeItem[]> {
        try {
            const environments = await this.configManager.getApiEnvironments();
            
            if (environments.length === 0) {
                // Show a helpful message when no environments exist
                return [new MessageTreeItem(
                    'No API environments configured',
                    'Click "Add API Environment" to get started',
                    'add'
                )];
            }
            
            return environments.map(env => new EnvironmentTreeItem(env));
        } catch (error) {
            console.error('Failed to load environments for tree view:', error);
            return [new MessageTreeItem(
                'Error loading environments',
                'Check the console for details',
                'error'
            )];
        }
    }
    
    /**
     * Get children for an environment (schemas)
     */
    private async getEnvironmentChildren(envItem: EnvironmentTreeItem): Promise<TreeItem[]> {
        try {
            const schemas = await this.configManager.getLoadedSchemas(envItem.environment.id);
            
            if (schemas.length === 0) {
                return [new MessageTreeItem(
                    'No schemas loaded',
                    'Use "Load Schema" commands to add schemas',
                    'file'
                )];
            }
            
            return schemas.map(schema => new SchemaTreeItem(schema, envItem.environment));
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
 * Tree item representing an API environment
 */
class EnvironmentTreeItem extends TreeItem {
    constructor(public readonly environment: ApiEnvironment) {
        super(environment.name, vscode.TreeItemCollapsibleState.Collapsed);
        
        // Set icon and context for the environment
        this.iconPath = new vscode.ThemeIcon('server-environment');
        this.tooltip = `${environment.name}\n${environment.baseUrl}\nAuth: ${environment.auth.type}`;
        this.description = environment.baseUrl;
        
        // Context value enables context menu items
        this.contextValue = 'environment';
        
        // Command to run when clicked (optional - shows environment details)
        this.command = {
            command: 'api-helper-extension.showEnvironmentDetails',
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
            command: 'api-helper-extension.showSchemaDetails',
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
        super(label, vscode.TreeItemCollapsibleState.None);
        
        // Set icon based on HTTP method
        this.iconPath = this.getMethodIcon(endpoint.method);
        this.tooltip = `${endpoint.method} ${endpoint.path}\n${endpoint.summary || 'No description'}`;
        this.description = endpoint.summary;
        this.contextValue = 'endpoint';
        
        // Command to show endpoint details when clicked
        this.command = {
            command: 'api-helper-extension.showEndpointDetails',
            title: 'Show Endpoint Details',
            arguments: [endpoint, schemaItem]
        };
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
        
        return new vscode.ThemeIcon(iconMap[method] || 'circle-outline');
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
