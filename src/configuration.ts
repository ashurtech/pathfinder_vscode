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
import { ApiEnvironment, ExtensionSettings, LoadedSchema } from './types';

/**
 * Manages configuration and storage for the API Helper extension
 */
export class ConfigurationManager {
    private context: vscode.ExtensionContext;
    
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
    // Extension Settings
    // ========================
    
    /**
     * Get extension settings with default values
     * Uses VS Code's configuration system (shows up in Settings UI)
     */
    getExtensionSettings(): ExtensionSettings {
        const config = vscode.workspace.getConfiguration('apiHelper');
        
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
     */
    async updateSetting(key: keyof ExtensionSettings, value: any, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
        const config = vscode.workspace.getConfiguration('apiHelper');
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
     */
    async getStorageStats(): Promise<{environmentCount: number, schemaCount: number}> {
        const environments = await this.getApiEnvironments();
        const schemas = await this.getLoadedSchemas();
        
        return {
            environmentCount: environments.length,
            schemaCount: schemas.length
        };
    }
}
