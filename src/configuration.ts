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
import { ExtensionSettings, ApiSchema, SchemaEnvironment, ApiSchemaGroup, ResolvedEnvironmentConfig, ApiEnvironment, ApiEnvironmentGroup, LoadedSchema, SchemaEnvironmentGroup, ApiAuthentication } from './types';

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
        this.context = context;    }
    
    // ========================
    // Schema-First Architecture Methods
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
    async getSchemaEnvironmentGroups(schemaId?: string): Promise<SchemaEnvironmentGroup[]> {
        const groups = this.context.globalState.get<SchemaEnvironmentGroup[]>('schemaEnvironmentGroups', []);
        const converted = groups.map(group => ({
            ...group,
            createdAt: new Date(group.createdAt)
        }));
        
        if (schemaId) {
            return converted.filter(group => group.schemaId === schemaId);
        }
        
        return converted;
    }
    
    /**
     * Save a schema environment group
     */
    async saveSchemaEnvironmentGroup(group: SchemaEnvironmentGroup): Promise<void> {
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
            ...(schema.baseConfig?.defaultHeaders ?? {}),
            ...(schema.platformConfig?.requiredHeaders ?? {}),
            ...(environment.customHeaders ?? {})
        };

        // Resolve authentication with inheritance from environment groups
        const resolvedAuthConfig = await this.resolveEnvironmentAuth(environment);
        
        return {
            environment,
            schema,
            resolvedHeaders,
            resolvedAuth: resolvedAuthConfig.auth,
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
    
    // ========================
    // MIGRATION SUPPORT METHODS (TO BE REMOVED LATER)
    // These methods are kept temporarily to support automatic migration
    // ========================
    
    /**
     * @deprecated Legacy method for migration only
     * Get all configured API environments (old architecture)
     */
    async getApiEnvironments(): Promise<ApiEnvironment[]> {
        const environments = this.context.globalState.get<ApiEnvironment[]>('apiEnvironments', []);
        return environments.map(env => ({
            ...env,
            createdAt: new Date(env.createdAt),
            lastUsed: env.lastUsed ? new Date(env.lastUsed) : undefined
        }));
    }
    
    /**
     * @deprecated Legacy method for migration only
     * Get all configured environment groups (old architecture)
     */
    async getEnvironmentGroups(): Promise<ApiEnvironmentGroup[]> {
        const groups = this.context.globalState.get<ApiEnvironmentGroup[]>('environmentGroups', []);
        return groups.map(group => ({
            ...group,
            createdAt: new Date(group.createdAt)
        }));
    }
    
    /**
     * @deprecated Legacy method for migration only
     * Get stored schemas for a specific environment (old architecture)
     */
    async getLoadedSchemas(environmentId?: string): Promise<LoadedSchema[]> {
        const schemas = this.context.globalState.get<LoadedSchema[]>('loadedSchemas', []);
        const convertedSchemas = schemas.map(schema => ({
            ...schema,
            loadedAt: new Date(schema.loadedAt)
        }));
        
        if (environmentId) {
            return convertedSchemas.filter(schema => schema.environmentId === environmentId);
        }
        
        return convertedSchemas;
    }
    
    /**
     * @deprecated Legacy method for migration only
     * Get a specific API environment by ID (old architecture)
     */
    async getApiEnvironment(environmentId: string): Promise<ApiEnvironment | undefined> {
        const environments = await this.getApiEnvironments();
        return environments.find(env => env.id === environmentId);
    }
    
    /**
     * @deprecated Legacy method for migration only
     * Save a loaded schema (old architecture)
     */
    async saveLoadedSchema(schema: LoadedSchema): Promise<void> {
        const schemas = await this.getLoadedSchemas();
        const filteredSchemas = schemas.filter(s => s.environmentId !== schema.environmentId);
        filteredSchemas.push(schema);
        await this.context.globalState.update('loadedSchemas', filteredSchemas);
        console.log(`Saved schema for environment: ${schema.environmentId}`);
    }
    
    /**
     * @deprecated Legacy method for migration only
     * Save an API environment (old architecture)
     */
    async saveApiEnvironment(environment: ApiEnvironment): Promise<void> {
        const environments = await this.getApiEnvironments();
        const existingIndex = environments.findIndex(env => env.id === environment.id);
        
        if (existingIndex >= 0) {
            environments[existingIndex] = environment;
        } else {
            environments.push(environment);
        }
        
        await this.context.globalState.update('apiEnvironments', environments);
        console.log(`Saved API environment: ${environment.name}`);
    }
    
    /**
     * @deprecated Legacy method for migration only
     * Save an environment group (old architecture)
     */
    async saveEnvironmentGroup(group: ApiEnvironmentGroup): Promise<void> {
        const groups = await this.getEnvironmentGroups();
        const existingIndex = groups.findIndex(g => g.id === group.id);
        
        if (existingIndex >= 0) {
            groups[existingIndex] = group;
        } else {
            groups.push(group);
        }
        
        await this.context.globalState.update('environmentGroups', groups);
        console.log(`Saved environment group: ${group.name}`);
    }
    
    /**
     * @deprecated Legacy method for migration only
     * Restore old data structure from backup (for migration rollback)
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
    
    /**
     * Update extension settings
     */
    async updateExtensionSettings(settings: ExtensionSettings): Promise<void> {
        const config = vscode.workspace.getConfiguration('pathfinder');
        await Promise.all([
            config.update('requestTimeout', settings.requestTimeout, vscode.ConfigurationTarget.Global),
            config.update('defaultCodeFormat', settings.defaultCodeFormat, vscode.ConfigurationTarget.Global),
            config.update('autoValidateSchemas', settings.autoValidateSchemas, vscode.ConfigurationTarget.Global),
            config.update('maxHistoryItems', settings.maxHistoryItems, vscode.ConfigurationTarget.Global)
        ]);
    }
    
    // ========================
    // Utility Methods
    // ========================
      /**
     * Clear all stored data (useful for testing or reset)
     */
    async clearAllData(): Promise<void> {
        await this.context.globalState.update('apiSchemas', []);
        await this.context.globalState.update('schemaEnvironments', []);
        await this.context.globalState.update('apiSchemaGroups', []);
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
     */
    async getStorageStats(): Promise<{schemaCount: number, environmentCount: number}> {
        const schemas = await this.getApiSchemas();
        const environments = await this.getSchemaEnvironments();
        
        return {
            schemaCount: schemas.length,
            environmentCount: environments.length
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

    /**
     * Get credentials for an environment, checking both environment and group level
     * Returns undefined if no credentials are found
     */
    async getCredentials(environment: SchemaEnvironment): Promise<{ username?: string; password?: string; apiKey?: string } | undefined> {
        try {
            // First check environment's own credentials
            if (environment.authSecretKey) {
                const secret = await this.context.secrets.get(environment.authSecretKey);
                if (secret) {
                    return JSON.parse(secret);
                }
            }

            // If no environment credentials, check group credentials
            if (environment.environmentGroupId) {
                const groups = await this.getSchemaEnvironmentGroups();
                const group = groups.find(g => g.id === environment.environmentGroupId);
                
                if (group?.authSecretKey) {
                    const secret = await this.context.secrets.get(group.authSecretKey);
                    if (secret) {
                        return JSON.parse(secret);
                    }
                }
            }

            return undefined;
        } catch (error) {
            console.error('Failed to get credentials:', error);
            throw new Error(`Failed to get credentials: ${error}`);
        }
    }

    /**
     * Set credentials for an environment or group
     * @param target The environment or group to set credentials for
     * @param credentials The credentials to store
     * @returns The secret key that was generated
     */
    async setCredentials(
        target: SchemaEnvironment | SchemaEnvironmentGroup,
        credentials: { username?: string; password?: string; apiKey?: string }
    ): Promise<string> {
        try {
            // Generate a unique key for this secret
            const secretKey = `pathfinder_${target.id}_${Date.now()}`;

            // Store the credentials in VS Code's secret storage
            await this.context.secrets.store(secretKey, JSON.stringify(credentials));

            // If there was a previous secret key, delete it
            if (target.authSecretKey) {
                await this.context.secrets.delete(target.authSecretKey);
            }

            return secretKey;
        } catch (error) {
            console.error('Failed to set credentials:', error);
            throw new Error(`Failed to set credentials: ${error}`);
        }
    }

    /**
     * Delete credentials for an environment or group
     */
    async deleteCredentials(target: SchemaEnvironment | SchemaEnvironmentGroup): Promise<void> {
        try {
            if (target.authSecretKey) {
                await this.context.secrets.delete(target.authSecretKey);
            }
        } catch (error) {
            console.error('Failed to delete credentials:', error);
            throw new Error(`Failed to delete credentials: ${error}`);
        }
    }

    /**
     * Update the export data to remove any sensitive information
     * This ensures secrets are never included in exports
     */
    private sanitizeExportData(data: any): any {
        const sanitized = { ...data };

        // Remove authSecretKey from environments
        if (Array.isArray(sanitized.environments)) {
            sanitized.environments = sanitized.environments.map((env: any) => {
                const { authSecretKey, ...rest } = env;
                return rest;
            });
        }

        // Remove authSecretKey from environment groups
        if (Array.isArray(sanitized.environmentGroups)) {
            sanitized.environmentGroups = sanitized.environmentGroups.map((group: any) => {
                const { authSecretKey, ...rest } = group;
                return rest;
            });
        }

        return sanitized;
    }

    /**
     * Export all configuration data to a JSON file
     * This includes schemas, environments, groups, and settings
     */
    async exportConfiguration(): Promise<string> {
        try {
            // Gather all data
            const schemas = await this.getApiSchemas();
            const environments = await this.getSchemaEnvironments();
            const schemaGroups = await this.getApiSchemaGroups();
            const environmentGroups = await this.getSchemaEnvironmentGroups();
            const settings = this.getExtensionSettings();

            // Create export object
            const exportData = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                schemas,
                environments,
                schemaGroups,
                environmentGroups,
                settings
            };

            // Sanitize the data to remove sensitive information
            const sanitizedData = this.sanitizeExportData(exportData);

            // Convert to JSON with pretty formatting
            return JSON.stringify(sanitizedData, null, 2);
        } catch (error) {
            console.error('Failed to export configuration:', error);
            throw new Error(`Failed to export configuration: ${error}`);
        }
    }

    /**
     * Import configuration from a JSON file
     * This will merge the imported data with existing data
     */
    async importConfiguration(jsonData: string): Promise<{
        environments: SchemaEnvironment[];
        environmentGroups: SchemaEnvironmentGroup[];
    }> {
        try {
            // Parse the JSON data
            const data = JSON.parse(jsonData);

            // Validate version
            if (!data.version) {
                throw new Error('Invalid configuration file: missing version');
            }

            // Import schemas
            if (Array.isArray(data.schemas)) {
                for (const schema of data.schemas) {
                    // Convert date strings back to Date objects
                    schema.loadedAt = new Date(schema.loadedAt);
                    schema.lastUpdated = new Date(schema.lastUpdated);
                    await this.saveApiSchema(schema);
                }
            }

            // Import environments
            if (Array.isArray(data.environments)) {
                for (const environment of data.environments) {
                    // Convert date strings back to Date objects
                    environment.createdAt = new Date(environment.createdAt);
                    environment.lastUsed = environment.lastUsed ? new Date(environment.lastUsed) : undefined;
                    await this.saveSchemaEnvironment(environment);
                }
            }

            // Import schema groups
            if (Array.isArray(data.schemaGroups)) {
                for (const group of data.schemaGroups) {
                    await this.saveApiSchemaGroup(group);
                }
            }

            // Import environment groups
            if (Array.isArray(data.environmentGroups)) {
                for (const group of data.environmentGroups) {
                    await this.saveSchemaEnvironmentGroup(group);
                }
            }

            // Import settings
            if (data.settings) {
                await this.updateExtensionSettings(data.settings);
            }

            return {
                environments: data.environments || [],
                environmentGroups: data.environmentGroups || []
            };

        } catch (error) {
            console.error('Failed to import configuration:', error);
            throw new Error(`Failed to import configuration: ${error}`);
        }
    }

    /**
     * Get a specific schema environment group by ID
     */
    async getSchemaEnvironmentGroupById(groupId: string): Promise<SchemaEnvironmentGroup | undefined> {
        const groups = await this.getSchemaEnvironmentGroups();
        return groups.find(group => group.id === groupId);
    }

    /**
     * Resolve authentication configuration for an environment, inheriting from group if needed
     */
    async resolveEnvironmentAuth(environment: SchemaEnvironment): Promise<{ auth: ApiAuthentication, authSecretKey?: string }> {
        // If environment has its own auth configured, use that
        if (environment.auth?.type && environment.auth.type !== 'none') {
            return {
                auth: environment.auth,
                authSecretKey: environment.authSecretKey
            };
        }

        // If environment is in a group, try to inherit from group
        if (environment.environmentGroupId) {
            const group = await this.getSchemaEnvironmentGroupById(environment.environmentGroupId);
            if (group?.defaultAuth?.type && group.defaultAuth.type !== 'none') {
                return {
                    auth: group.defaultAuth,
                    authSecretKey: group.authSecretKey
                };
            }
        }

        // Fallback to no authentication
        return {
            auth: { type: 'none' }
        };
    }
}
