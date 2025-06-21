/**
 * Core TypeScript type definitions for the API Helper Extension
 * 
 * This file defines the "shape" of data objects we'll use throughout the extension.
 * Think of interfaces as blueprints that describe what properties an object should have.
 * 
 * TypeScript will help us catch errors if we try to use these objects incorrectly!
 */

import { OpenAPIV3 } from 'openapi-types';

// ========================
// MIGRATION SUPPORT TYPES (TO BE REMOVED LATER)
// These types are kept temporarily to support automatic migration
// from environment-first to schema-first architecture
// ========================

/**
 * @deprecated Legacy type for migration only
 * Represents a group of API environments that share the same schema
 */
export interface ApiEnvironmentGroup {
    id: string;
    name: string;
    description?: string;
    sharedSchemaId?: string;
    createdAt: Date;
    color?: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'yellow';
}

/**
 * @deprecated Legacy type for migration only  
 * Represents a single API environment (old architecture)
 */
export interface ApiEnvironment {
    id: string;
    name: string;
    baseUrl: string;
    auth: ApiAuthentication;
    description?: string;
    groupId?: string;
    createdAt: Date;
    lastUsed?: Date;
}

/**
 * @deprecated Legacy type for migration only
 * Represents a loaded OpenAPI schema with additional metadata (old architecture)
 */
export interface LoadedSchema {
    environmentId: string;
    schema: OpenAPIV3.Document;
    source: string;
    loadedAt: Date;
    isValid: boolean;
    validationErrors?: string[];
    platformConfig?: RequestGeneratorConfig;
}

// ========================
// CURRENT SCHEMA-FIRST TYPES
// ========================

/**
 * Different ways to authenticate with an API
 * The 'type' field determines which other fields are required
 */
export interface ApiAuthentication {
    /** The type of authentication to use */
    type: 'none' | 'apikey' | 'bearer' | 'basic';
    
    /** For API key authentication - the key value */
    apiKey?: string;
    
    /** For API key authentication - where to put the key (header or query) */
    apiKeyLocation?: 'header' | 'query';
    
    /** For API key authentication - the name of the header/query parameter */
    apiKeyName?: string;
    
    /** For bearer token authentication */
    bearerToken?: string;
    
    /** For basic authentication - username */
    username?: string;
    
    /** For basic authentication - password */
    password?: string;
}

/**
 * Represents a single API endpoint from the OpenAPI schema
 * This is what users will see in the browse tree
 */
export interface ApiEndpoint {
    /** The HTTP path (e.g., "/api/users/{id}") */
    path: string;
    
    /** The HTTP method (GET, POST, PUT, DELETE, etc.) */
    method: string;
    
    /** Unique identifier for this endpoint */
    operationId?: string;
    
    /** Brief description of what this endpoint does */
    summary?: string;
    
    /** Detailed description */
    description?: string;
    
    /** Tags for grouping endpoints */
    tags?: string[];
    
    /** Parameters this endpoint accepts */
    parameters?: ApiParameter[];
    
    /** Request body schema (for POST/PUT requests) */
    requestBody?: any;
      /** Possible response schemas */
    responses?: { [statusCode: string]: any };
}

/**
 * Simplified endpoint information for HTTP requests
 */
export interface EndpointInfo {
    /** The HTTP path (e.g., "/api/users/{id}") */
    path: string;
    
    /** The HTTP method (GET, POST, PUT, DELETE, etc.) */
    method: string;
    
    /** Brief description of what this endpoint does */
    summary?: string;
    
    /** Detailed description */
    description?: string;
    
    /** Parameters this endpoint accepts */
    parameters?: ApiParameter[];
    
    /** Tags for grouping endpoints */
    tags?: string[];
}

/**
 * Represents a parameter for an API endpoint
 * This helps with autocompletion and validation
 */
export interface ApiParameter {
    /** Parameter name */
    name: string;
    
    /** Where this parameter goes (path, query, header, cookie) */
    in: 'path' | 'query' | 'header' | 'cookie';
    
    /** Is this parameter required? */
    required: boolean;
    
    /** Parameter description */
    description?: string;
    
    /** The data type (string, number, boolean, etc.) */
    schema?: any;
    
    /** Example value */
    example?: any;
}

/**
 * Configuration for generating code in different formats
 * This will help us generate curl, Ansible, PowerShell commands
 */
export interface CodeGenerationOptions {
    /** Which format to generate (curl, ansible, powershell, javascript, python) */
    format: 'curl' | 'ansible' | 'powershell' | 'javascript' | 'python';
    
    /** Include authentication headers? */
    includeAuth: boolean;
    
    /** Include example request body? */
    includeExampleBody: boolean;
    
    /** Pretty-format the output? */
    prettyFormat: boolean;
    
    /** Additional options specific to each format */
    formatOptions?: { [key: string]: any };
}

/**
 * Result of executing an API request
 * This is what we'll show when users execute commands
 */
export interface ApiExecutionResult {
    /** The original request details */
    request: {
        url: string;
        method: string;
        headers: { [key: string]: string };
        body?: any;
    };
    
    /** The response we got back */
    response: {
        status: number;
        statusText: string;
        headers: { [key: string]: string };
        data: any;
        duration: number; // How long the request took in milliseconds
    };
    
    /** When this request was executed */
    executedAt: Date;
    
    /** Any errors that occurred */
    error?: string;
}

/**
 * Settings for the entire extension
 * This will be stored in VS Code's settings system
 */
export interface ExtensionSettings {
    /** Default timeout for API requests (in milliseconds) */
    requestTimeout: number;
    
    /** Default code generation format */
    defaultCodeFormat: CodeGenerationOptions['format'];
    
    /** Whether to automatically validate schemas when loaded */
    autoValidateSchemas: boolean;
    
    /** Maximum number of recent requests to keep in history */
    maxHistoryItems: number;
}

/**
 * Configuration for request generators - platform-specific settings
 */
export interface RequestGeneratorConfig {
    /** Platform identifier (e.g., 'kibana', 'elasticsearch', 'generic') */
    platform: string;
    
    /** Additional headers required by this platform */
    requiredHeaders?: Record<string, string>;
    
    /** Authentication format overrides */
    authConfig?: {
        /** Use specific auth header format (e.g., 'ApiKey' instead of 'Bearer') */
        headerFormat?: string;
        /** Additional auth parameters */
        additionalParams?: Record<string, string>;
    };
    
    /** SSL/TLS specific configurations */
    sslConfig?: {
        /** Whether this platform commonly uses self-signed certificates */
        allowSelfSigned?: boolean;
        /** Additional SSL handling notes */
        notes?: string;
    };
    
    /** Platform-specific code generation hints */
    codeGenHints?: {
        /** Additional imports needed for this platform */
        imports?: string[];
        /** Platform-specific comments */
        comments?: string[];
        /** Special error handling */
        errorHandling?: string;
    };
}

/**
 * Predefined platform configurations
 */
export const PLATFORM_CONFIGS: Record<string, RequestGeneratorConfig> = {
    kibana: {
        platform: 'kibana',
        requiredHeaders: {
            'kbn-xsrf': 'true'
        },
        authConfig: {
            headerFormat: 'ApiKey'
        },
        sslConfig: {
            allowSelfSigned: true,
            notes: 'Kibana often uses self-signed certificates in development'
        },
        codeGenHints: {
            comments: [
                'Kibana requires kbn-xsrf header for CSRF protection',
                'API keys use "Authorization: ApiKey <key>" format'
            ]
        }
    },
    elasticsearch: {
        platform: 'elasticsearch',
        authConfig: {
            headerFormat: 'ApiKey'
        },
        sslConfig: {
            allowSelfSigned: true,
            notes: 'Elasticsearch often uses self-signed certificates'
        }
    },
    generic: {
        platform: 'generic'
    }
};

/**
 * NEW: Schema-first data model interfaces for architectural refactor
 */

/**
 * Top-level schema entity in the new schema-first architecture
 * Schemas are now the primary organizational unit, with environments as children
 */
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
    
    /** Optional group membership */
    groupId?: string;
}

/**
 * Environment entity that references a schema and provides environment-specific overrides
 * Environments are now children of schemas, not standalone entities
 */
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
    
    /** Optional environment group membership within a schema */
    environmentGroupId?: string;
    
    /**
     * Reference to a secret key in VS Code SecretStorage for credentials (API key or password)
     * If present, this environment uses this secret for authentication
     */
    authSecretKey?: string;
}

/**
 * Environment groups within a schema for organizing environments
 * These are different from ApiSchemaGroup which organizes schemas
 */
export interface SchemaEnvironmentGroup {
    /** Unique identifier for this group */
    id: string;
    
    /** Which schema this group belongs to */
    schemaId: string;
    
    /** Human-readable name */
    name: string;
    
    /** Optional description */
    description?: string;
    
    /** When this group was created */
    createdAt: Date;
    
    /** Color/icon theme for visual distinction */
    color?: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'yellow';
    
    /** Default authentication configuration for environments in this group */
    defaultAuth?: ApiAuthentication;
    
    /**
     * Reference to a secret key in VS Code SecretStorage for credentials (API key or password)
     * If present, this group provides default credentials for its environments
     */
    authSecretKey?: string;
}

/**
 * Groups for organizing multiple schemas
 * These groups help organize schemas for better management
 */
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

/**
 * Configuration resolver that combines schema and environment settings at runtime
 * This provides the final resolved configuration for making API requests
 */
export interface ResolvedEnvironmentConfig {
    /** The environment details */
    environment: SchemaEnvironment;
    
    /** The schema this environment uses */
    schema: ApiSchema;
    
    /** Resolved headers (schema defaults + platform headers + environment overrides) */
    resolvedHeaders: Record<string, string>;
    
    /** Resolved authentication */
    resolvedAuth: ApiAuthentication;
    
    /** Resolved timeout */
    resolvedTimeout: number;
    
    /** Platform configuration from schema */
    platformConfig?: RequestGeneratorConfig;
}

/**
 * Migration utilities type for handling data migration
 */
export interface MigrationResult {
    /** Whether migration was successful */
    success: boolean;
    
    /** Number of environments migrated */
    environmentsMigrated: number;
    
    /** Number of schemas created */
    schemasCreated: number;
    
    /** Number of groups migrated */
    groupsMigrated: number;
    
    /** Any errors encountered during migration */
    errors: string[];
    
    /** Backup location of old data */
    backupLocation?: string;
}
