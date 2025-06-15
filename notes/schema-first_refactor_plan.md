# Schema-First Architecture Refactor Plan

## Overview

This document outlines the comprehensive refactor plan to transition the VS Code extension "Pathfinder - OpenAPI Explorer" from its current environment-first architecture to a schema-first architecture. This change will provide better organization, improved configuration management, and more intuitive user workflows.

## Current State vs Target State

### Current Architecture (Environment-First)
```
Environment (Dev, Test, Prod)
├── Load Schema...
├── Schema A
│   ├── Tag: Authentication
│   │   ├── GET /auth/login
│   │   └── POST /auth/logout
│   └── Tag: Users
│       ├── GET /users
│       └── POST /users
└── Schema B (if multiple schemas per environment)
```

### Target Architecture (Schema-First)
```
Schema A (Kibana API v8.0)
├── Environment: Dev
│   ├── Base URL: https://kibana-dev.company.com
│   ├── Auth: API Key
│   └── Headers: kbn-xsrf: true
├── Environment: Test
│   ├── Base URL: https://kibana-test.company.com
│   ├── Auth: Bearer Token
│   └── Headers: kbn-xsrf: true
├── Environment: Prod
│   ├── Base URL: https://kibana-prod.company.com
│   ├── Auth: Basic Auth
│   └── Headers: kbn-xsrf: true
├── Tag: Authentication
│   ├── GET /auth/login
│   └── POST /auth/logout
└── Tag: Users
    ├── GET /users
    └── POST /users
```

## Benefits of Schema-First Architecture

1. **Better Organization**: Related endpoints grouped by API spec, not deployment environment
2. **Configuration Inheritance**: Base configuration at schema level, environment-specific overrides
3. **Simplified Management**: One place to update API documentation that affects all environments
4. **Clearer Relationships**: See which environments use which API versions
5. **Better Testing**: Compare same endpoint across multiple environments
6. **Reduced Duplication**: Schema details stored once, referenced by multiple environments

## Implementation Plan

### Phase 1: Data Model Migration

#### 1.1 New TypeScript Interfaces

**File**: `src/types.ts`

```typescript
/**
 * Schema-first data model interfaces
 */

// NEW: Top-level schema entity
export interface ApiSchema {
    /** Unique identifier for this schema */
    id: string;
    
    /** Human-readable name (e.g., "Kibana API v8.0") */
    name: string;
    
    /** Optional description */
    description?: string;
    
    /** The actual OpenAPI specification document */
    schema: OpenAPIV3.Document;
    
    /** Where we loaded this schema from */
    source: string;
    
    /** When we loaded this schema */
    loadedAt: Date;
    
    /** When this schema was last updated */
    lastUpdated: Date;
    
    /** Whether the schema passed validation */
    isValid: boolean;
    
    /** Any validation errors we found */
    validationErrors?: string[];
    
    /** Platform-specific configurations (inherited by environments) */
    platformConfig?: RequestGeneratorConfig;
    
    /** Base configuration that environments can inherit */
    baseConfig?: {
        /** Default headers to include */
        defaultHeaders?: Record<string, string>;
        
        /** Default authentication type */
        defaultAuthType?: 'none' | 'apikey' | 'bearer' | 'basic';
        
        /** Default timeout */
        defaultTimeout?: number;
    };
    
    /** Version/tag from the OpenAPI spec */
    version: string;
    
    /** Color/icon theme for visual distinction */
    color?: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'yellow';
}

// UPDATED: Environment now references schema and can override settings
export interface SchemaEnvironment {
    /** Unique identifier for this environment */
    id: string;
    
    /** Which schema this environment uses */
    schemaId: string;
    
    /** Human-readable name (e.g., "Dev", "Test", "Production") */
    name: string;
    
    /** Base URL for this environment */
    baseUrl: string;
    
    /** Authentication configuration (can override schema defaults) */
    auth: ApiAuthentication;
    
    /** Optional description */
    description?: string;
    
    /** Environment-specific headers (merged with schema defaults) */
    customHeaders?: Record<string, string>;
    
    /** Environment-specific timeout (overrides schema default) */
    timeout?: number;
    
    /** When this environment was created */
    createdAt: Date;
    
    /** When this environment was last used */
    lastUsed?: Date;
    
    /** Environment type for visual grouping */
    type?: 'development' | 'testing' | 'staging' | 'production' | 'other';
}

// UPDATED: Groups now group schemas, not environments
export interface ApiSchemaGroup {
    /** Unique identifier for this group */
    id: string;
    
    /** Human-readable name */
    name: string;
    
    /** Optional description */
    description?: string;
    
    /** When this group was created */
    createdAt: Date;
    
    /** Color/icon theme for visual distinction */
    color?: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'yellow';
}

// NEW: Schema membership in groups
export interface SchemaGroupMembership {
    schemaId: string;
    groupId: string;
    addedAt: Date;
}

// NEW: Configuration resolver for runtime
export interface ResolvedEnvironmentConfig {
    /** The environment details */
    environment: SchemaEnvironment;
    
    /** The schema this environment uses */
    schema: ApiSchema;
    
    /** Resolved headers (schema defaults + environment overrides) */
    resolvedHeaders: Record<string, string>;
    
    /** Resolved authentication */
    resolvedAuth: ApiAuthentication;
    
    /** Resolved timeout */
    resolvedTimeout: number;
    
    /** Platform configuration from schema */
    platformConfig?: RequestGeneratorConfig;
}
```

#### 1.2 Migration Utilities

**File**: `src/migration/data-migration.ts`

```typescript
/**
 * Utilities for migrating from environment-first to schema-first architecture
 */

export class DataMigration {
    constructor(private configManager: ConfigurationManager) {}
    
    /**
     * Migrate existing data to new schema-first structure
     */
    async migrateToSchemaFirst(): Promise<void> {
        console.log('Starting migration to schema-first architecture...');
        
        // 1. Get existing data
        const oldEnvironments = await this.configManager.getApiEnvironments();
        const oldSchemas = await this.configManager.getLoadedSchemas();
        const oldGroups = await this.configManager.getEnvironmentGroups();
        
        // 2. Create new schemas from loaded schemas
        const newSchemas = await this.createSchemasFromLoadedSchemas(oldSchemas);
        
        // 3. Create new environments that reference schemas
        const newEnvironments = await this.createEnvironmentsFromOldData(oldEnvironments, oldSchemas, newSchemas);
        
        // 4. Convert environment groups to schema groups
        const newGroups = await this.convertEnvironmentGroupsToSchemaGroups(oldGroups, newSchemas);
        
        // 5. Save new data structure
        await this.saveNewDataStructure(newSchemas, newEnvironments, newGroups);
        
        // 6. Set migration flag
        await this.configManager.setMigrationComplete();
        
        console.log('Migration completed successfully!');
    }
    
    /**
     * Check if migration is needed
     */
    async isMigrationNeeded(): Promise<boolean> {
        return !(await this.configManager.isMigrationComplete());
    }
    
    private async createSchemasFromLoadedSchemas(oldSchemas: LoadedSchema[]): Promise<ApiSchema[]> {
        const schemaMap = new Map<string, LoadedSchema>();
        
        // Group by source to deduplicate
        oldSchemas.forEach(schema => {
            const key = schema.source;
            if (!schemaMap.has(key) || schema.loadedAt > schemaMap.get(key)!.loadedAt) {
                schemaMap.set(key, schema);
            }
        });
        
        return Array.from(schemaMap.values()).map(schema => this.convertToNewSchema(schema));
    }
    
    private convertToNewSchema(oldSchema: LoadedSchema): ApiSchema {
        const info = new SchemaLoader().getSchemaInfo(oldSchema.schema);
        
        return {
            id: this.generateSchemaId(oldSchema.source, info.title),
            name: `${info.title} v${info.version}`,
            description: info.description,
            schema: oldSchema.schema,
            source: oldSchema.source,
            loadedAt: oldSchema.loadedAt,
            lastUpdated: oldSchema.loadedAt,
            isValid: oldSchema.isValid,
            validationErrors: oldSchema.validationErrors,
            platformConfig: oldSchema.platformConfig,
            version: info.version,
            baseConfig: {
                defaultHeaders: oldSchema.platformConfig?.requiredHeaders || {},
                defaultAuthType: 'none',
                defaultTimeout: 30000
            }
        };
    }
    
    // ... additional migration methods
}
```

### Phase 2: Storage Layer Updates

#### 2.1 Updated Configuration Manager

**File**: `src/configuration.ts`

```typescript
/**
 * Updated configuration manager for schema-first architecture
 */

export class ConfigurationManager {
    // ... existing code ...
    
    // ========================
    // Schema Management (NEW)
    // ========================
    
    /**
     * Get all API schemas
     */
    async getApiSchemas(): Promise<ApiSchema[]> {
        const schemas = this.context.globalState.get<ApiSchema[]>('apiSchemas', []);
        return schemas.map(schema => ({
            ...schema,
            loadedAt: new Date(schema.loadedAt),
            lastUpdated: new Date(schema.lastUpdated)
        }));
    }
    
    /**
     * Save an API schema
     */
    async saveApiSchema(schema: ApiSchema): Promise<void> {
        const schemas = await this.getApiSchemas();
        const existingIndex = schemas.findIndex(s => s.id === schema.id);
        
        if (existingIndex >= 0) {
            schemas[existingIndex] = { ...schema, lastUpdated: new Date() };
        } else {
            schemas.push(schema);
        }
        
        await this.context.globalState.update('apiSchemas', schemas);
        console.log(`Saved API schema: ${schema.name}`);
    }
    
    /**
     * Get schema environments for a specific schema
     */
    async getSchemaEnvironments(schemaId?: string): Promise<SchemaEnvironment[]> {
        const environments = this.context.globalState.get<SchemaEnvironment[]>('schemaEnvironments', []);
        const converted = environments.map(env => ({
            ...env,
            createdAt: new Date(env.createdAt),
            lastUsed: env.lastUsed ? new Date(env.lastUsed) : undefined
        }));
        
        if (schemaId) {
            return converted.filter(env => env.schemaId === schemaId);
        }
        
        return converted;
    }
    
    /**
     * Resolve environment configuration with schema inheritance
     */
    async resolveEnvironmentConfig(environmentId: string): Promise<ResolvedEnvironmentConfig | undefined> {
        const environments = await this.getSchemaEnvironments();
        const environment = environments.find(env => env.id === environmentId);
        
        if (!environment) {
            return undefined;
        }
        
        const schemas = await this.getApiSchemas();
        const schema = schemas.find(s => s.id === environment.schemaId);
        
        if (!schema) {
            throw new Error(`Schema not found for environment: ${environment.name}`);
        }
        
        // Merge configurations
        const resolvedHeaders = {
            ...(schema.baseConfig?.defaultHeaders || {}),
            ...(schema.platformConfig?.requiredHeaders || {}),
            ...(environment.customHeaders || {})
        };
        
        return {
            environment,
            schema,
            resolvedHeaders,
            resolvedAuth: environment.auth,
            resolvedTimeout: environment.timeout || schema.baseConfig?.defaultTimeout || 30000,
            platformConfig: schema.platformConfig
        };
    }
    
    // ========================
    // Migration Support
    // ========================
    
    /**
     * Check if migration to schema-first is complete
     */
    async isMigrationComplete(): Promise<boolean> {
        return this.context.globalState.get('schemaFirstMigrationComplete', false);
    }
    
    /**
     * Mark migration as complete
     */
    async setMigrationComplete(): Promise<void> {
        await this.context.globalState.update('schemaFirstMigrationComplete', true);
    }
}
```

### Phase 3: UI/Tree View Refactor

#### 3.1 New Tree Provider Structure

**File**: `src/tree-provider.ts`

```typescript
/**
 * Updated tree provider for schema-first architecture
 */

export class ApiTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    // ... existing code ...
    
    /**
     * Get root level items - schemas and schema groups
     */
    private async getSchemas(): Promise<TreeItem[]> {
        const children: TreeItem[] = [];
        
        // Add "Load New Schema" action as first item
        children.push(new LoadNewSchemaActionTreeItem());
        
        // Get schema groups
        const groups = await this.configManager.getApiSchemaGroups();
        children.push(...groups.map(group => new SchemaGroupTreeItem(group)));
        
        // Get ungrouped schemas
        const ungroupedSchemas = await this.configManager.getUngroupedSchemas();
        children.push(...ungroupedSchemas.map(schema => new SchemaTreeItem(schema)));
        
        if (children.length === 1) {
            children.push(new MessageTreeItem(
                'No schemas loaded',
                'Use "Load New Schema" to get started',
                'info'
            ));
        }
        
        return children;
    }
    
    /**
     * Get children for a schema (environments + endpoints)
     */
    private async getSchemaChildren(schemaItem: SchemaTreeItem): Promise<TreeItem[]> {
        const children: TreeItem[] = [];
        
        // Schema management actions
        children.push(new AddEnvironmentActionTreeItem(schemaItem.schema));
        children.push(new RefreshSchemaActionTreeItem(schemaItem.schema));
        children.push(new EditSchemaActionTreeItem(schemaItem.schema));
        
        // Get environments for this schema
        const environments = await this.configManager.getSchemaEnvironments(schemaItem.schema.id);
        if (environments.length > 0) {
            children.push(new SeparatorTreeItem('Environments'));
            children.push(...environments.map(env => new EnvironmentTreeItem(env, schemaItem.schema)));
        }
        
        // Get endpoint tags
        const endpoints = this.schemaLoader.getEndpoints(schemaItem.schema.schema);
        const tags = this.groupEndpointsByTags(endpoints);
        
        if (tags.size > 0) {
            children.push(new SeparatorTreeItem('API Endpoints'));
            children.push(...Array.from(tags.entries()).map(([tag, endpoints]) => 
                new TagTreeItem(tag, endpoints, schemaItem.schema)
            ));
        }
        
        return children;
    }
    
    /**
     * Get children for an environment (actions + resolved config info)
     */
    private async getEnvironmentChildren(envItem: EnvironmentTreeItem): Promise<TreeItem[]> {
        const children: TreeItem[] = [];
        
        // Environment actions
        children.push(new TestConnectionActionTreeItem(envItem.environment));
        children.push(new EditEnvironmentActionTreeItem(envItem.environment));
        children.push(new DuplicateEnvironmentActionTreeItem(envItem.environment));
        
        // Show resolved configuration
        try {
            const resolvedConfig = await this.configManager.resolveEnvironmentConfig(envItem.environment.id);
            if (resolvedConfig) {
                children.push(new SeparatorTreeItem('Configuration'));
                children.push(new ConfigInfoTreeItem('Base URL', resolvedConfig.environment.baseUrl));
                children.push(new ConfigInfoTreeItem('Auth Type', resolvedConfig.resolvedAuth.type));
                
                if (Object.keys(resolvedConfig.resolvedHeaders).length > 0) {
                    children.push(new ConfigInfoTreeItem(
                        'Headers', 
                        Object.keys(resolvedConfig.resolvedHeaders).join(', ')
                    ));
                }
            }
        } catch (error) {
            children.push(new MessageTreeItem('Configuration Error', error.message, 'error'));
        }
        
        return children;
    }
}

// New tree item classes
class SchemaTreeItem extends TreeItem {
    constructor(public readonly schema: ApiSchema) {
        super(schema.name, vscode.TreeItemCollapsibleState.Collapsed);
        
        this.iconPath = new vscode.ThemeIcon(
            schema.isValid ? 'file-code' : 'error',
            new vscode.ThemeColor(schema.isValid ? 'charts.green' : 'charts.red')
        );
        
        this.tooltip = `${schema.name}\nVersion: ${schema.version}\nSource: ${schema.source}\nLoaded: ${schema.loadedAt.toLocaleString()}`;
        this.description = `v${schema.version}`;
        this.contextValue = 'schema';
        
        // Command to show schema details
        this.command = {
            command: 'pathfinder.showSchemaDetails',
            title: 'Show Schema Details',
            arguments: [schema]
        };
    }
}

class EnvironmentTreeItem extends TreeItem {
    constructor(
        public readonly environment: SchemaEnvironment,
        public readonly schema: ApiSchema
    ) {
        super(environment.name, vscode.TreeItemCollapsibleState.Collapsed);
        
        const typeIcons = {
            development: 'debug-alt',
            testing: 'beaker',
            staging: 'preview',
            production: 'rocket',
            other: 'server'
        };
        
        this.iconPath = new vscode.ThemeIcon(typeIcons[environment.type || 'other']);
        this.tooltip = `${environment.name}\n${environment.baseUrl}\nAuth: ${environment.auth.type}`;
        this.description = environment.baseUrl;
        this.contextValue = 'environment';
    }
}

class LoadNewSchemaActionTreeItem extends TreeItem {
    constructor() {
        super('📂 Load New Schema...', vscode.TreeItemCollapsibleState.None);
        this.tooltip = 'Load a new OpenAPI schema from file or URL';
        this.contextValue = 'loadSchemaAction';
        this.command = {
            command: 'pathfinder.loadNewSchema',
            title: 'Load New Schema'
        };
    }
}

class AddEnvironmentActionTreeItem extends TreeItem {
    constructor(public readonly schema: ApiSchema) {
        super('➕ Add Environment', vscode.TreeItemCollapsibleState.None);
        this.tooltip = 'Add a new environment for this schema';
        this.contextValue = 'addEnvironmentAction';
        this.command = {
            command: 'pathfinder.addEnvironment',
            title: 'Add Environment',
            arguments: [schema]
        };
    }
}
```

### Phase 4: Command Updates

#### 4.1 New Command Handlers

**File**: `src/extension.ts`

```typescript
/**
 * Updated command handlers for schema-first architecture
 */

/**
 * Load a new schema (replaces environment-specific loading)
 */
async function loadNewSchemaHandler() {
    try {
        // Choose load method
        const loadMethod = await vscode.window.showQuickPick([
            { label: 'Load from File', value: 'file' },
            { label: 'Load from URL', value: 'url' }
        ], {
            placeHolder: 'How would you like to load the schema?'
        });
        
        if (!loadMethod) return;
        
        let schema: ApiSchema;
        
        if (loadMethod.value === 'file') {
            schema = await loadSchemaFromFile();
        } else {
            schema = await loadSchemaFromUrl();
        }
        
        // Save the new schema
        await configManager.saveApiSchema(schema);
        treeProvider.refresh();
        
        vscode.window.showInformationMessage(
            `✅ Schema loaded: ${schema.name}\nNow add environments to start making requests!`
        );
        
    } catch (error) {
        console.error('Failed to load schema:', error);
        vscode.window.showErrorMessage(`Failed to load schema: ${error}`);
    }
}

/**
 * Add environment to a schema
 */
async function addEnvironmentHandler(schema: ApiSchema) {
    try {
        // Get environment details
        const name = await vscode.window.showInputBox({
            prompt: 'Environment name (e.g., "Development", "Production")',
            placeHolder: 'Development'
        });
        
        if (!name) return;
        
        const baseUrl = await vscode.window.showInputBox({
            prompt: 'Base URL for this environment',
            placeHolder: 'https://api.example.com'
        });
        
        if (!baseUrl) return;
        
        // Environment type
        const type = await vscode.window.showQuickPick([
            { label: 'Development', value: 'development' },
            { label: 'Testing', value: 'testing' },
            { label: 'Staging', value: 'staging' },
            { label: 'Production', value: 'production' },
            { label: 'Other', value: 'other' }
        ], {
            placeHolder: 'Select environment type'
        });
        
        if (!type) return;
        
        // Authentication setup (reuse existing auth flow)
        const auth = await setupAuthentication();
        
        const environment: SchemaEnvironment = {
            id: generateUniqueId(),
            schemaId: schema.id,
            name,
            baseUrl,
            auth,
            type: type.value as any,
            createdAt: new Date()
        };
        
        await configManager.saveSchemaEnvironment(environment);
        treeProvider.refresh();
        
        vscode.window.showInformationMessage(
            `✅ Environment added: ${name}\nReady to make requests!`
        );
        
    } catch (error) {
        console.error('Failed to add environment:', error);
        vscode.window.showErrorMessage(`Failed to add environment: ${error}`);
    }
}

/**
 * Test connection to environment
 */
async function testConnectionHandler(environment: SchemaEnvironment) {
    try {
        const resolvedConfig = await configManager.resolveEnvironmentConfig(environment.id);
        if (!resolvedConfig) {
            throw new Error('Failed to resolve environment configuration');
        }
        
        // Perform a simple health check request
        const healthCheckUrl = new URL('/health', environment.baseUrl).toString();
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Testing connection to ${environment.name}...`,
            cancellable: false
        }, async () => {
            // Implementation of connection test
            // This would use the resolved configuration
        });
        
    } catch (error) {
        console.error('Connection test failed:', error);
        vscode.window.showErrorMessage(`Connection test failed: ${error}`);
    }
}
```

### Phase 5: Migration Strategy

#### 5.1 Automatic Migration on Extension Startup

**File**: `src/extension.ts`

```typescript
/**
 * Extension activation with migration support
 */

export async function activate(context: vscode.ExtensionContext) {
    console.log('Activating Pathfinder - OpenAPI Explorer...');
    
    // Initialize configuration manager
    configManager = new ConfigurationManager(context);
    
    // Check if migration is needed
    const migrationNeeded = await new DataMigration(configManager).isMigrationNeeded();
    
    if (migrationNeeded) {
        const result = await vscode.window.showInformationMessage(
            '🔄 Pathfinder Update: Schema-First Architecture\n\n' +
            'We\'re upgrading to a new organization system where schemas are top-level ' +
            'entities with environments as children. This provides better organization ' +
            'and configuration management.\n\n' +
            'Your existing data will be automatically migrated. Continue?',
            'Migrate Now',
            'Learn More',
            'Skip'
        );
        
        if (result === 'Learn More') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-repo/wiki/schema-first-migration'));
            return;
        }
        
        if (result === 'Migrate Now') {
            await performMigration();
        }
    }
    
    // Continue with normal activation...
    await initializeExtension(context);
}

async function performMigration() {
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Migrating to Schema-First Architecture...',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Analyzing existing data...' });
            
            const migration = new DataMigration(configManager);
            
            progress.report({ message: 'Converting schemas...' });
            await migration.migrateToSchemaFirst();
            
            progress.report({ message: 'Updating tree view...' });
            treeProvider.refresh();
        });
        
        vscode.window.showInformationMessage(
            '✅ Migration completed successfully!\n\n' +
            'Your extension now uses the new schema-first organization. ' +
            'Check out the updated tree view in the Explorer panel.'
        );
        
    } catch (error) {
        console.error('Migration failed:', error);
        vscode.window.showErrorMessage(
            `Migration failed: ${error}\n\n` +
            'Your data is safe. Please report this issue on GitHub.'
        );
    }
}
```

### Phase 6: Testing Strategy

#### 6.1 Unit Tests

**File**: `src/test/migration.test.ts`

```typescript
import * as assert from 'assert';
import { DataMigration } from '../migration/data-migration';
import { ConfigurationManager } from '../configuration';

describe('Data Migration', () => {
    let migration: DataMigration;
    let configManager: ConfigurationManager;
    
    beforeEach(() => {
        // Setup test environment
    });
    
    test('Should migrate environment-first to schema-first', async () => {
        // Test migration logic
    });
    
    test('Should preserve all existing data', async () => {
        // Test data preservation
    });
    
    test('Should handle edge cases', async () => {
        // Test error cases
    });
});
```

#### 6.2 Integration Tests

**File**: `src/test/schema-first.test.ts`

```typescript
describe('Schema-First Architecture', () => {
    test('Should load schema and create environments', async () => {
        // Test full workflow
    });
    
    test('Should resolve configuration correctly', async () => {
        // Test configuration inheritance
    });
    
    test('Should handle tree view interactions', async () => {
        // Test UI interactions
    });
});
```

### Phase 7: Documentation Updates

#### 7.1 User Guide Updates

**File**: `docs/user-guide.md`

```markdown
# Schema-First Workflow

## Overview

Pathfinder now organizes your APIs using a schema-first approach where OpenAPI schemas 
are top-level entities, and environments are children of schemas.

## Getting Started

1. **Load a Schema**: Click "📂 Load New Schema..." in the Explorer
2. **Add Environments**: Add development, testing, and production environments
3. **Make Requests**: Select endpoints and choose your target environment

## Benefits

- **Better Organization**: Group related endpoints by API specification
- **Configuration Inheritance**: Set defaults at schema level, override per environment
- **Easier Management**: Update API documentation once, affects all environments
```

## Implementation Timeline

### Milestone 1: Foundation (Week 1-2)
- [ ] Create new TypeScript interfaces
- [ ] Implement data migration utilities
- [ ] Add migration flag support to configuration manager

### Milestone 2: Core Functionality (Week 3-4)
- [ ] Update configuration manager for schema-first storage
- [ ] Implement configuration resolution logic
- [ ] Create basic tree provider updates

### Milestone 3: UI Refactor (Week 5-6)
- [ ] Complete tree provider refactor
- [ ] Update all command handlers
- [ ] Implement new action items

### Milestone 4: Migration & Testing (Week 7-8)
- [ ] Complete migration logic
- [ ] Comprehensive testing
- [ ] Documentation updates

### Milestone 5: Release (Week 9-10)
- [ ] User acceptance testing
- [ ] Performance optimization
- [ ] Release preparation

## Risk Mitigation

1. **Data Loss Prevention**: Migration creates backup before changes
2. **Rollback Strategy**: Migration flag allows reverting to old structure
3. **Incremental Migration**: Users can opt-in to migration
4. **Extensive Testing**: Unit and integration tests for all scenarios

## Success Metrics

1. **Migration Success Rate**: >95% successful automatic migrations
2. **User Adoption**: Users successfully adapt to new workflow
3. **Performance**: No degradation in extension performance
4. **Error Reduction**: Fewer configuration errors due to inheritance

## Conclusion

This schema-first refactor will significantly improve the user experience by providing:
- Better organization and discoverability
- Simplified configuration management
- More intuitive workflows
- Reduced duplication and errors

The migration strategy ensures existing users can seamlessly transition to the new architecture while maintaining all their existing data and configurations.