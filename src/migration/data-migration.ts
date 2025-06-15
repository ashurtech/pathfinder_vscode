/**
 * Data Migration Utilities for Schema-First Architecture Refactor
 * 
 * This module handles the migration from the current environment-first architecture
 * to the new schema-first architecture where schemas are top-level entities
 * and environments are children of schemas.
 */

import { ConfigurationManager } from '../configuration';
import { SchemaLoader } from '../schema-loader';
import { 
    ApiEnvironment, 
    LoadedSchema, 
    ApiEnvironmentGroup,
    ApiSchema,
    SchemaEnvironment,
    ApiSchemaGroup,
    MigrationResult
} from '../types';

/**
 * Backup data interface
 */
interface BackupData {
    version: string;
    timestamp: string;
    environments: ApiEnvironment[];
    schemas: LoadedSchema[];
    groups: ApiEnvironmentGroup[];
}

/**
 * Handles migration from environment-first to schema-first architecture
 */
export class DataMigration {
    private readonly schemaLoader: SchemaLoader;
    
    constructor(private readonly configManager: ConfigurationManager) {
        this.schemaLoader = new SchemaLoader();
    }
    
    /**
     * Check if migration to schema-first architecture is needed
     */
    async isMigrationNeeded(): Promise<boolean> {
        return !(await this.configManager.isMigrationComplete());
    }
    
    /**
     * Perform the complete migration from environment-first to schema-first
     */
    async migrateToSchemaFirst(): Promise<MigrationResult> {
        console.log('🔄 Starting migration to schema-first architecture...');
        
        const result: MigrationResult = {
            success: false,
            environmentsMigrated: 0,
            schemasCreated: 0,
            groupsMigrated: 0,
            errors: []
        };
        
        try {
            // Step 1: Create backup of existing data
            const backupLocation = await this.createDataBackup();
            result.backupLocation = backupLocation;
            
            // Step 2: Get existing data
            const oldEnvironments = await this.configManager.getApiEnvironments();
            const oldSchemas = await this.configManager.getLoadedSchemas();
            const oldGroups = await this.configManager.getEnvironmentGroups();
            
            console.log(`📊 Found ${oldEnvironments.length} environments, ${oldSchemas.length} schemas, ${oldGroups.length} groups`);
            
            // Step 3: Create new schemas from loaded schemas
            const newSchemas = await this.createSchemasFromLoadedSchemas(oldSchemas);
            result.schemasCreated = newSchemas.length;
            
            // Step 4: Create new environments that reference schemas
            const newEnvironments = await this.createEnvironmentsFromOldData(oldEnvironments, oldSchemas, newSchemas);
            result.environmentsMigrated = newEnvironments.length;
            
            // Step 5: Convert environment groups to schema groups
            const newGroups = await this.convertEnvironmentGroupsToSchemaGroups(oldGroups, newSchemas);
            result.groupsMigrated = newGroups.length;
            
            // Step 6: Save new data structure
            await this.saveNewDataStructure(newSchemas, newEnvironments, newGroups);
            
            // Step 7: Mark migration as complete
            await this.configManager.setMigrationComplete();
            
            result.success = true;
            console.log('✅ Migration completed successfully!');
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
            result.errors.push(error instanceof Error ? error.message : String(error));
            result.success = false;
        }
        
        return result;
    }
      /**
     * Create a backup of existing data before migration
     */
    private async createDataBackup(): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupKey = `pathfinder-backup-${timestamp}`;
        
        // Get all current data
        const environments = await this.configManager.getApiEnvironments();
        const schemas = await this.configManager.getLoadedSchemas();
        const groups = await this.configManager.getEnvironmentGroups();
        
        const backupData: BackupData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            environments,
            schemas,
            groups
        };
        
        // Store backup using helper method
        await this.configManager.storeBackupData(backupKey, backupData);
        
        console.log(`💾 Backup created: ${backupKey}`);
        return backupKey;
    }
    
    /**
     * Create new ApiSchema entities from existing LoadedSchema entities
     */
    private async createSchemasFromLoadedSchemas(oldSchemas: LoadedSchema[]): Promise<ApiSchema[]> {
        const schemaMap = new Map<string, LoadedSchema>();
        
        // Deduplicate schemas by source (URL or file path)
        oldSchemas.forEach(schema => {
            const key = schema.source;
            if (!schemaMap.has(key) || schema.loadedAt > schemaMap.get(key)!.loadedAt) {
                schemaMap.set(key, schema);
            }
        });
        
        console.log(`📋 Converting ${schemaMap.size} unique schemas...`);
        
        return Array.from(schemaMap.values()).map(oldSchema => this.convertLoadedSchemaToApiSchema(oldSchema));
    }
    
    /**
     * Convert a LoadedSchema to the new ApiSchema format
     */
    private convertLoadedSchemaToApiSchema(oldSchema: LoadedSchema): ApiSchema {
        const info = this.schemaLoader.getSchemaInfo(oldSchema.schema);
        
        return {
            id: this.generateSchemaId(oldSchema.source, info.title),
            name: this.generateSchemaName(info.title, info.version),
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
            },
            color: this.assignSchemaColor(info.title)
        };
    }
    
    /**
     * Create new SchemaEnvironment entities from old ApiEnvironment entities
     */
    private async createEnvironmentsFromOldData(
        oldEnvironments: ApiEnvironment[],
        oldSchemas: LoadedSchema[],
        newSchemas: ApiSchema[]
    ): Promise<SchemaEnvironment[]> {
        const newEnvironments: SchemaEnvironment[] = [];
        
        console.log(`🌍 Converting ${oldEnvironments.length} environments...`);
        
        for (const oldEnv of oldEnvironments) {
            // Find schemas that were loaded for this environment
            const envSchemas = oldSchemas.filter(schema => schema.environmentId === oldEnv.id);
            
            if (envSchemas.length === 0) {
                // Environment with no schemas - create a placeholder or skip
                console.warn(`⚠️ Environment ${oldEnv.name} has no schemas, skipping...`);
                continue;
            }
            
            // For each schema, create a new environment
            for (const envSchema of envSchemas) {
                const matchingNewSchema = newSchemas.find(schema => schema.source === envSchema.source);
                if (!matchingNewSchema) {
                    console.warn(`⚠️ Could not find matching schema for ${envSchema.source}`);
                    continue;
                }
                
                const newEnv: SchemaEnvironment = {
                    id: this.generateEnvironmentId(oldEnv.id, matchingNewSchema.id),
                    schemaId: matchingNewSchema.id,
                    name: oldEnv.name,
                    baseUrl: oldEnv.baseUrl,
                    auth: oldEnv.auth,
                    description: oldEnv.description,
                    customHeaders: {},
                    createdAt: oldEnv.createdAt,
                    lastUsed: oldEnv.lastUsed,
                    type: this.inferEnvironmentType(oldEnv.name)
                };
                
                newEnvironments.push(newEnv);
            }
        }
        
        return newEnvironments;
    }
    
    /**
     * Convert environment groups to schema groups
     */
    private async convertEnvironmentGroupsToSchemaGroups(
        oldGroups: ApiEnvironmentGroup[],
        newSchemas: ApiSchema[]
    ): Promise<ApiSchemaGroup[]> {
        console.log(`📁 Converting ${oldGroups.length} groups...`);
        
        return oldGroups.map(oldGroup => ({
            id: oldGroup.id,
            name: oldGroup.name,
            description: oldGroup.description,
            createdAt: oldGroup.createdAt,
            color: oldGroup.color
        }));
    }
      /**
     * Save the new data structure to storage
     */
    private async saveNewDataStructure(
        schemas: ApiSchema[],
        environments: SchemaEnvironment[],
        groups: ApiSchemaGroup[]
    ): Promise<void> {
        console.log('💾 Saving new data structure...');
        
        // Use helper method to save new structure
        await this.configManager.storeSchemaFirstData(schemas, environments, groups);
        
        console.log(`✅ Saved ${schemas.length} schemas, ${environments.length} environments, ${groups.length} groups`);
    }
    
    /**
     * Generate a unique ID for a schema based on source and title
     */
    private generateSchemaId(source: string, title: string): string {
        const sanitized = `${title}-${source}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
        return `schema-${sanitized}-${Date.now()}`;
    }
    
    /**
     * Generate a user-friendly schema name
     */
    private generateSchemaName(title: string, version: string): string {
        if (version && version !== '1.0.0' && version !== '1.0') {
            return `${title} v${version}`;
        }
        return title;
    }
    
    /**
     * Generate a unique environment ID
     */
    private generateEnvironmentId(oldEnvId: string, schemaId: string): string {
        return `env-${oldEnvId}-${schemaId}`;
    }
    
    /**
     * Assign a color to a schema based on its title
     */
    private assignSchemaColor(title: string): 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'yellow' {
        const colors: Array<'blue' | 'green' | 'orange' | 'purple' | 'red' | 'yellow'> = 
            ['blue', 'green', 'orange', 'purple', 'red', 'yellow'];
        
        // Simple hash-based color assignment
        let hash = 0;
        for (let i = 0; i < title.length; i++) {
            hash = title.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        return colors[Math.abs(hash) % colors.length];
    }
    
    /**
     * Infer environment type from name
     */
    private inferEnvironmentType(name: string): 'development' | 'testing' | 'staging' | 'production' | 'other' {
        const lowerName = name.toLowerCase();
        
        if (lowerName.includes('dev') || lowerName.includes('development')) {
            return 'development';
        }
        if (lowerName.includes('test') || lowerName.includes('testing')) {
            return 'testing';
        }
        if (lowerName.includes('stag') || lowerName.includes('staging')) {
            return 'staging';
        }
        if (lowerName.includes('prod') || lowerName.includes('production')) {
            return 'production';
        }
        
        return 'other';
    }
      /**
     * Restore data from backup (rollback functionality)
     */
    async restoreFromBackup(backupKey: string): Promise<boolean> {
        try {
            const backupData = await this.configManager.getBackupData(backupKey) as BackupData | undefined;
            if (!backupData) {
                throw new Error(`Backup ${backupKey} not found`);
            }
            
            // Restore original data structure using helper method
            await this.configManager.restoreOldDataStructure(
                backupData.environments,
                backupData.schemas,
                backupData.groups
            );
            
            console.log(`✅ Restored data from backup: ${backupKey}`);
            return true;
            
        } catch (error) {
            console.error('❌ Failed to restore from backup:', error);
            return false;
        }
    }
}
