/**
 * Configuration Manager for API Helper Extension
 * 
 * This class handles storing and retrieving API environments and extension settings.
 * It uses VS Code's built-in configuration system to persist data between sessions.
 * 
 * VS Code provides two types of storage:
 * 1. Settings (workspace/user settings) - for user preferences
 * 2. GlobalState/WorkspaceState - for extension-specific data
 */

import * as vscode from 'vscode';
import { ApiEnvironment, ApiEnvironmentGroup, ExtensionSettings, LoadedSchema, ApiSchema, SchemaEnvironment, ApiSchemaGroup, ResolvedEnvironmentConfig } from './types';

/**
 * Manages configuration and storage for the API Helper extension
 */
export class ConfigurationManager {
    private readonly context: vscode.ExtensionContext;
    
    /**
     * Constructor requires the extension context to access storage
     * @param context VS Code extension context - gives us access to storage and settings
     */
    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }
    
    // ========================
    // API Environment Management
    // ========================
    
    /**
     * Get all configured API environments
     * Returns an array of all environments the user has set up
     */
    async getApiEnvironments(): Promise<ApiEnvironment[]> {
        // VS Code stores extension data in globalState (persists across workspaces)
        // or workspaceState (only for current workspace)
        const environments = this.context.globalState.get<ApiEnvironment[]>('apiEnvironments', []);
        
        // Convert stored date strings back to Date objects
        // (JSON serialization converts dates to strings)
        return environments.map(env => ({
            ...env,
            createdAt: new Date(env.createdAt),
            lastUsed: env.lastUsed ? new Date(env.lastUsed) : undefined
        }));
    }
    
    /**
     * Save a new API environment or update an existing one
     * @param environment The environment to save
     */
    async saveApiEnvironment(environment: ApiEnvironment): Promise<void> {
        const environments = await this.getApiEnvironments();
        
        // Find if this environment already exists (by ID)
        const existingIndex = environments.findIndex(env => env.id === environment.id);
        
        if (existingIndex >= 0) {
            // Update existing environment
            environments[existingIndex] = environment;
        } else {
            // Add new environment
            environments.push(environment);
        }
        
        // Save back to VS Code storage
        await this.context.globalState.update('apiEnvironments', environments);
        
        // Log for debugging (shows up in VS Code's developer console)
        console.log(`Saved API environment: ${environment.name}`);
    }
    
    /**
     * Delete an API environment
     * @param environmentId The ID of the environment to delete
     */
    async deleteApiEnvironment(environmentId: string): Promise<boolean> {
        const environments = await this.getApiEnvironments();
        const filteredEnvironments = environments.filter(env => env.id !== environmentId);
        
        // Check if we actually found and removed something
        if (filteredEnvironments.length === environments.length) {
            return false; // Nothing was deleted
        }
        
        await this.context.globalState.update('apiEnvironments', filteredEnvironments);
        console.log(`Deleted API environment: ${environmentId}`);
        return true;
    }
    
    /**
     * Get a specific API environment by ID
     * @param environmentId The ID to look for
     */
    async getApiEnvironment(environmentId: string): Promise<ApiEnvironment | undefined> {
        const environments = await this.getApiEnvironments();
        return environments.find(env => env.id === environmentId);
    }
    
    /**
     * Update the "last used" timestamp for an environment
     * This helps us show recently used environments first
     * @param environmentId The environment that was just used
     */
    async updateLastUsed(environmentId: string): Promise<void> {
        const environment = await this.getApiEnvironment(environmentId);
        if (environment) {
            environment.lastUsed = new Date();
            await this.saveApiEnvironment(environment);
        }
    }
    
    // ========================
    // Environment Group Management
    // ========================
    
    /**
     * Get all configured environment groups
     */
    async getEnvironmentGroups(): Promise<ApiEnvironmentGroup[]> {
        const groups = this.context.globalState.get<ApiEnvironmentGroup[]>('environmentGroups', []);
        
        // Convert stored date strings back to Date objects
        return groups.map(group => ({
            ...group,
            createdAt: new Date(group.createdAt)
        }));
    }
    
    /**
     * Save or update an environment group
     * @param group The group to save
     */
    async saveEnvironmentGroup(group: ApiEnvironmentGroup): Promise<void> {
        const groups = await this.getEnvironmentGroups();
        
        // Check if this is an update (group with same ID exists)
        const existingIndex = groups.findIndex(g => g.id === group.id);
        
        if (existingIndex >= 0) {
            // Update existing group
            groups[existingIndex] = group;
        } else {
            // Add new group
            groups.push(group);
        }
        
        await this.context.globalState.update('environmentGroups', groups);
        console.log(`Saved environment group: ${group.name}`);
    }
    
    /**
     * Delete an environment group
     * @param groupId The ID of the group to delete
     */
    async deleteEnvironmentGroup(groupId: string): Promise<boolean> {
        const groups = await this.getEnvironmentGroups();
        const filteredGroups = groups.filter(group => group.id !== groupId);
        
        if (filteredGroups.length === groups.length) {
            return false; // Nothing was deleted
        }
        
        // Also remove group membership from all environments
        const environments = await this.getApiEnvironments();
        const updatedEnvironments = environments.map(env => 
            env.groupId === groupId ? { ...env, groupId: undefined } : env
        );
        await this.context.globalState.update('apiEnvironments', updatedEnvironments);
        
        await this.context.globalState.update('environmentGroups', filteredGroups);
        console.log(`Deleted environment group: ${groupId}`);
        return true;
    }
    
    /**
     * Get a specific environment group by ID
     * @param groupId The ID to look for
     */
    async getEnvironmentGroup(groupId: string): Promise<ApiEnvironmentGroup | undefined> {
        const groups = await this.getEnvironmentGroups();
        return groups.find(group => group.id === groupId);
    }
    
    /**
     * Get environments that belong to a specific group
     * @param groupId The group ID
     */
    async getEnvironmentsInGroup(groupId: string): Promise<ApiEnvironment[]> {
        const environments = await this.getApiEnvironments();
        return environments.filter(env => env.groupId === groupId);
    }
    
    /**
     * Get environments that don't belong to any group
     */
    async getUngroupedEnvironments(): Promise<ApiEnvironment[]> {
        const environments = await this.getApiEnvironments();
        return environments.filter(env => !env.groupId);
    }
    
    /**
     * Move an environment to a group (or remove from group if groupId is undefined)
     * @param environmentId The environment to move
     * @param groupId The target group ID (or undefined to remove from group)
     */
    async moveEnvironmentToGroup(environmentId: string, groupId?: string): Promise<boolean> {
        const environment = await this.getApiEnvironment(environmentId);
        if (!environment) {
            return false;
        }
        
        environment.groupId = groupId;
        await this.saveApiEnvironment(environment);
        return true;
    }
    
    // ========================
    // Schema Storage Management
    // ========================
    
    /**
     * Get stored schemas for a specific environment
     * @param environmentId The environment to get schemas for
     */
    async getLoadedSchemas(environmentId?: string): Promise<LoadedSchema[]> {
        const schemas = this.context.globalState.get<LoadedSchema[]>('loadedSchemas', []);
        
        // Convert date strings back to Date objects
        const convertedSchemas = schemas.map(schema => ({
            ...schema,
            loadedAt: new Date(schema.loadedAt)
        }));
        
        // Filter by environment if specified
        if (environmentId) {
            return convertedSchemas.filter(schema => schema.environmentId === environmentId);
        }
        
        return convertedSchemas;
    }
    
    /**
     * Save a loaded schema
     * @param schema The schema to save
     */
    async saveLoadedSchema(schema: LoadedSchema): Promise<void> {
        const schemas = await this.getLoadedSchemas();
        
        // Remove any existing schema for this environment
        // (we only keep one schema per environment for now)
        const filteredSchemas = schemas.filter(s => s.environmentId !== schema.environmentId);
        
        // Add the new schema
        filteredSchemas.push(schema);
        
        await this.context.globalState.update('loadedSchemas', filteredSchemas);
        console.log(`Saved schema for environment: ${schema.environmentId}`);
    }
    
    // ========================
    // Schema-First Architecture Support (NEW)
    // ========================
    
    /**
     * Get all API schemas in the new schema-first architecture
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
     * Save an API schema in the new architecture
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
     * Delete an API schema and all its environments
     */
    async deleteApiSchema(schemaId: string): Promise<boolean> {
        const schemas = await this.getApiSchemas();
        const filteredSchemas = schemas.filter(s => s.id !== schemaId);
        
        if (filteredSchemas.length === schemas.length) {
            return false; // Nothing was deleted
        }
        
        // Also delete all environments that use this schema
        const environments = await this.getSchemaEnvironments();
        const filteredEnvironments = environments.filter(env => env.schemaId !== schemaId);
        await this.context.globalState.update('schemaEnvironments', filteredEnvironments);
        
        await this.context.globalState.update('apiSchemas', filteredSchemas);
        console.log(`Deleted API schema: ${schemaId}`);
        return true;
    }
    
    /**
     * Get schema environments for a specific schema or all environments
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
     * Save a schema environment
     */
    async saveSchemaEnvironment(environment: SchemaEnvironment): Promise<void> {
        const environments = await this.getSchemaEnvironments();
        const existingIndex = environments.findIndex(env => env.id === environment.id);
        
        if (existingIndex >= 0) {
            environments[existingIndex] = environment;
        } else {
            environments.push(environment);
        }
        
        await this.context.globalState.update('schemaEnvironments', environments);
        console.log(`Saved schema environment: ${environment.name}`);
    }
    
    /**
     * Delete a schema environment
     */
    async deleteSchemaEnvironment(environmentId: string): Promise<boolean> {
        const environments = await this.getSchemaEnvironments();
        const filteredEnvironments = environments.filter(env => env.id !== environmentId);
        
        if (filteredEnvironments.length === environments.length) {
            return false; // Nothing was deleted
        }
        
        await this.context.globalState.update('schemaEnvironments', filteredEnvironments);
        console.log(`Deleted schema environment: ${environmentId}`);
        return true;
    }
    
    /**
     * Get API schema groups
     */
    async getApiSchemaGroups(): Promise<ApiSchemaGroup[]> {
        const groups = this.context.globalState.get<ApiSchemaGroup[]>('apiSchemaGroups', []);
        return groups.map(group => ({
            ...group,
            createdAt: new Date(group.createdAt)
        }));
    }
    
    /**
     * Save an API schema group
     */
    async saveApiSchemaGroup(group: ApiSchemaGroup): Promise<void> {
        const groups = await this.getApiSchemaGroups();
        const existingIndex = groups.findIndex(g => g.id === group.id);
        
        if (existingIndex >= 0) {
            groups[existingIndex] = group;
        } else {
            groups.push(group);
        }
          await this.context.globalState.update('apiSchemaGroups', groups);
        console.log(`Saved API schema group: ${group.name}`);
    }
    
    /**
     * Get schema environment groups for a specific schema
     */
    async getSchemaEnvironmentGroups(schemaId?: string): Promise<any[]> {
        const groups = this.context.globalState.get<any[]>('schemaEnvironmentGroups', []);
        const converted = groups.map(group => ({
            ...group,
            createdAt: new Date(group.createdAt)
        }));
        
        if (schemaId) {
            return converted.filter(group => group.schemaId === schemaId);
        }
        
        return converted;    }
    
    /**
     * Save a schema environment group
     */
    async saveSchemaEnvironmentGroup(group: any): Promise<void> {
        const groups = await this.getSchemaEnvironmentGroups();
        const existingIndex = groups.findIndex(g => g.id === group.id);
        
        if (existingIndex >= 0) {
            groups[existingIndex] = group;
        } else {
            groups.push(group);
        }
        
        await this.context.globalState.update('schemaEnvironmentGroups', groups);
        console.log(`Saved schema environment group: ${group.name}`);
    }
    
    /**
     * Delete a schema environment group
     */
    async deleteSchemaEnvironmentGroup(groupId: string): Promise<boolean> {
        const groups = await this.getSchemaEnvironmentGroups();
        const filteredGroups = groups.filter(group => group.id !== groupId);
        
        if (filteredGroups.length === groups.length) {
            return false; // Nothing was deleted
        }
        
        await this.context.globalState.update('schemaEnvironmentGroups', filteredGroups);
        console.log(`Deleted schema environment group: ${groupId}`);
        return true;
    }
      /**
     * Get schemas that belong to a specific group
     */
    async getApiSchemasByGroup(groupId: string): Promise<ApiSchema[]> {
        const schemas = await this.getApiSchemas();
        return schemas.filter(schema => schema.groupId === groupId);
    }
    
    /**
     * Get schemas that belong to a specific group
     */
    async getSchemasInGroup(groupId: string): Promise<ApiSchema[]> {
        const schemas = await this.getApiSchemas();
        return schemas.filter(schema => schema.groupId === groupId);
    }
    
    /**
     * Get schemas that don't belong to any group
     */
    async getUngroupedSchemas(): Promise<ApiSchema[]> {
        const schemas = await this.getApiSchemas();
        return schemas.filter(schema => !schema.groupId);
    }
    
    /**
     * Resolve environment configuration with schema inheritance
     * This combines schema defaults with environment-specific overrides
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
        
        // Merge configurations in order of precedence:
        // 1. Schema base defaults (lowest priority)
        // 2. Schema platform headers
        // 3. Environment custom headers (highest priority)
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
            resolvedTimeout: environment.timeout ?? schema.baseConfig?.defaultTimeout ?? 30000,
            platformConfig: schema.platformConfig
        };
    }
    
    /**
     * Get a specific API schema by ID
     */
    async getApiSchema(schemaId: string): Promise<ApiSchema | undefined> {
        const schemas = await this.getApiSchemas();
        return schemas.find(schema => schema.id === schemaId);
    }
    
    /**
     * Get a specific schema environment by ID
     */
    async getSchemaEnvironment(environmentId: string): Promise<SchemaEnvironment | undefined> {
        const environments = await this.getSchemaEnvironments();
        return environments.find(env => env.id === environmentId);
    }
    
    /**
     * Update the "last used" timestamp for a schema environment
     */
    async updateSchemaEnvironmentLastUsed(environmentId: string): Promise<void> {
        const environment = await this.getSchemaEnvironment(environmentId);
        if (environment) {
            environment.lastUsed = new Date();
            await this.saveSchemaEnvironment(environment);
        }
    }
    
    // ========================
    // Migration Support
    // ========================
    
    /**
     * Check if migration to schema-first architecture is complete
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

    // ========================
    // Migration Helper Methods
    // ========================
    
    /**
     * Store backup data for migration
     */
    async storeBackupData(backupKey: string, data: any): Promise<void> {
        await this.context.globalState.update(backupKey, data);
    }
    
    /**
     * Retrieve backup data for migration
     */
    async getBackupData(backupKey: string): Promise<any> {
        return this.context.globalState.get(backupKey);
    }
    
    /**
     * Store new schema-first data during migration
     */
    async storeSchemaFirstData(schemas: ApiSchema[], environments: SchemaEnvironment[], groups: ApiSchemaGroup[]): Promise<void> {
        await this.context.globalState.update('apiSchemas', schemas);
        await this.context.globalState.update('schemaEnvironments', environments);
        await this.context.globalState.update('apiSchemaGroups', groups);
    }
    
    /**
     * Restore old data structure from backup
     */
    async restoreOldDataStructure(environments: ApiEnvironment[], schemas: LoadedSchema[], groups: ApiEnvironmentGroup[]): Promise<void> {
        await this.context.globalState.update('apiEnvironments', environments);
        await this.context.globalState.update('loadedSchemas', schemas);
        await this.context.globalState.update('environmentGroups', groups);
        await this.context.globalState.update('schemaFirstMigrationComplete', false);
    }
    
    // ========================
    // Extension Settings
    // ========================
    
    /**
     * Get extension settings with default values
     * Uses VS Code's configuration system (shows up in Settings UI)
     */    getExtensionSettings(): ExtensionSettings {
        const config = vscode.workspace.getConfiguration('pathfinder');
        
        return {
            requestTimeout: config.get('requestTimeout', 30000), // 30 seconds default
            defaultCodeFormat: config.get('defaultCodeFormat', 'curl'),
            autoValidateSchemas: config.get('autoValidateSchemas', true),
            maxHistoryItems: config.get('maxHistoryItems', 50)
        };
    }
    
    /**
     * Update a specific setting
     * @param key The setting key
     * @param value The new value
     * @param target Where to save (global or workspace)
     */    async updateSetting(key: keyof ExtensionSettings, value: any, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
        const config = vscode.workspace.getConfiguration('pathfinder');
        await config.update(key, value, target);
    }
    
    // ========================
    // Utility Methods
    // ========================
    
    /**
     * Clear all stored data (useful for testing or reset)
     */
    async clearAllData(): Promise<void> {
        await this.context.globalState.update('apiEnvironments', []);
        await this.context.globalState.update('loadedSchemas', []);
        console.log('Cleared all stored data');
    }
    
    /**
     * Generate a unique ID for new environments
     * Uses timestamp + random string for uniqueness
     */
    generateEnvironmentId(): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `env_${timestamp}_${random}`;
    }
    
    /**
     * Get storage statistics (for debugging)
     */    async getStorageStats(): Promise<{environmentCount: number, schemaCount: number}> {
        const environments = await this.getApiEnvironments();
        const schemas = await this.getLoadedSchemas();
        
        return {
            environmentCount: environments.length,
            schemaCount: schemas.length
        };
    }

    // ========================
    // Secret Storage Helper Methods
    // ========================

    /**
     * Store a secret value securely using VS Code's SecretStorage
     */
    async storeSecret(key: string, value: string): Promise<void> {
        await this.context.secrets.store(key, value);
    }

    /**
     * Get a secret value from VS Code's SecretStorage
     */
    async getSecret(key: string): Promise<string | undefined> {
        return await this.context.secrets.get(key);
    }

    /**
     * Delete a secret from VS Code's SecretStorage
     */
    async deleteSecret(key: string): Promise<void> {
        await this.context.secrets.delete(key);
    }
}
