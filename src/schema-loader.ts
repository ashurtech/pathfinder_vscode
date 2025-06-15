/**
 * OpenAPI Schema Loader and Parser
 * 
 * This class handles loading, parsing, and validating OpenAPI/Swagger specifications.
 * It can load schemas from URLs, files, or raw JSON/YAML content.
 * 
 * We use the 'swagger-parser' library which handles all the complex OpenAPI validation
 * and reference resolution (when schemas reference other schemas).
 */

import * as vscode from 'vscode';
import axios from 'axios';
import { OpenAPIV3 } from 'openapi-types';
import { LoadedSchema, ApiEnvironment, ApiEndpoint, ApiParameter } from './types';

// Use require for swagger-parser due to TypeScript definition issues
const SwaggerParser = require('swagger-parser');

/**
 * Helper function to break circular references in an object
 * This is needed because SwaggerParser.parse() can create circular references
 * when resolving $ref references, which breaks JSON serialization for storage
 */
function breakCircularReferences(obj: any, seen = new WeakSet(), path = ''): any {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (seen.has(obj)) {
        // Return a reference marker instead of the circular object
        return { 
            $circular: true, 
            $ref: obj.constructor?.name ?? 'Object',
            $path: path
        };
    }
    
    seen.add(obj);
    
    try {
        if (Array.isArray(obj)) {
            const result = obj.map((item, index) => 
                breakCircularReferences(item, seen, `${path}[${index}]`)
            );
            seen.delete(obj);
            return result;
        }
        
        const cleaned: any = {};
        for (const [key, value] of Object.entries(obj)) {
            const newPath = path ? `${path}.${key}` : key;
            cleaned[key] = breakCircularReferences(value, seen, newPath);
        }
        
        seen.delete(obj);
        return cleaned;
    } catch (error) {
        seen.delete(obj);
        // If we can't process this object, return a safe placeholder
        return { 
            $error: true, 
            $message: 'Could not process object due to complexity',
            $type: obj.constructor?.name ?? 'Object'
        };
    }
}

/**
 * Handles loading and parsing OpenAPI schemas
 */
export class SchemaLoader {
    
    /**
     * Load an OpenAPI schema from a URL
     * @param url The URL to load the schema from
     * @param environment The API environment this schema belongs to
     * @param timeout Optional timeout in milliseconds
     */
    async loadFromUrl(url: string, environment: ApiEnvironment, timeout: number = 30000): Promise<LoadedSchema> {
        try {
            console.log(`Loading schema from URL: ${url}`);
            
            // Set up HTTP request with authentication if needed
            const headers: { [key: string]: string } = {};
            
            // Add authentication headers based on environment config
            if (environment.auth.type === 'bearer' && environment.auth.bearerToken) {
                headers.Authorization = `Bearer ${environment.auth.bearerToken}`;
            } else if (environment.auth.type === 'apikey' && environment.auth.apiKey) {                if (environment.auth.apiKeyLocation === 'header') {
                    headers[environment.auth.apiKeyName ?? 'X-API-Key'] = environment.auth.apiKey;
                }
                // Note: Query parameters for API keys would be handled in the URL
            } else if (environment.auth.type === 'basic' && environment.auth.username && environment.auth.password) {
                const credentials = Buffer.from(`${environment.auth.username}:${environment.auth.password}`).toString('base64');
                headers.Authorization = `Basic ${credentials}`;
            }
                  // Make the HTTP request to get the schema
            const response = await axios.get(url, {
                timeout,
                // Accept both JSON and YAML content
                headers: {
                    ...headers,
                    'Accept': 'application/json, application/yaml, text/yaml'
                }
            });            // Parse and validate the schema using swagger-parser
            const result = await this.parseAndValidateSchema(response.data);
            
            // Detect platform from schema and generate platform config
            const detectedPlatform = this.detectPlatformFromSchema(result.schema);
            const platformConfig = this.generatePlatformConfig(detectedPlatform);
            
            return {
                environmentId: environment.id,
                schema: result.schema,
                source: url,
                loadedAt: new Date(),
                isValid: result.isValid,
                validationErrors: result.validationErrors,
                platformConfig: platformConfig
            };
            
        } catch (error) {
            // If something went wrong, return an invalid schema with error details
            console.error(`Failed to load schema from ${url}:`, error);
            
            return {
                environmentId: environment.id,
                schema: {} as OpenAPIV3.Document, // Empty schema as placeholder
                source: url,
                loadedAt: new Date(),
                isValid: false,
                validationErrors: [this.getErrorMessage(error)]
            };
        }
    }
    
    /**
     * Load an OpenAPI schema from a local file
     * @param filePath Path to the schema file
     * @param environment The API environment this schema belongs to
     */
    async loadFromFile(filePath: string, environment: ApiEnvironment): Promise<LoadedSchema> {
        try {
            console.log(`Loading schema from file: ${filePath}`);
            
            // Read the file content
            const fileUri = vscode.Uri.file(filePath);
            const fileContent = await vscode.workspace.fs.readFile(fileUri);
            const contentString = Buffer.from(fileContent).toString('utf8');
            
            // Parse the content (could be JSON or YAML)
            let schemaData;
            try {
                // Try parsing as JSON first
                schemaData = JSON.parse(contentString);
            } catch {
                // If JSON parsing fails, swagger-parser will handle YAML
                schemaData = contentString;
            }            // Parse and validate the schema
            const result = await this.parseAndValidateSchema(schemaData);
            
            // Detect platform from schema and generate platform config
            const detectedPlatform = this.detectPlatformFromSchema(result.schema);
            const platformConfig = this.generatePlatformConfig(detectedPlatform);
            
            return {
                environmentId: environment.id,
                schema: result.schema,
                source: filePath,
                loadedAt: new Date(),
                isValid: result.isValid,
                validationErrors: result.validationErrors,
                platformConfig: platformConfig
            };
            
        } catch (error) {
            console.error(`Failed to load schema from ${filePath}:`, error);
            
            return {
                environmentId: environment.id,
                schema: {} as OpenAPIV3.Document,
                source: filePath,
                loadedAt: new Date(),
                isValid: false,
                validationErrors: [this.getErrorMessage(error)]
            };
        }
    }    /**
     * Parse and validate an OpenAPI schema using swagger-parser
     * @param schemaData The raw schema data (object or string)
     */
    private async parseAndValidateSchema(schemaData: any): Promise<{
        schema: OpenAPIV3.Document;
        isValid: boolean;
        validationErrors: string[];
    }> {
        const result = {
            schema: {} as OpenAPIV3.Document,
            isValid: true,
            validationErrors: [] as string[]
        };

        try {            // First try to parse without strict validation
            const api = await SwaggerParser.parse(schemaData);
            
            // Ensure we have an OpenAPI 3.x document
            if (!api.openapi?.startsWith('3.')) {
                throw new Error('Only OpenAPI 3.x specifications are supported');
            }            // Clean the schema to remove circular references before storing
            try {
                const cleanedSchema = breakCircularReferences(api);
                
                // Test if the cleaned schema can be serialized (for storage)
                try {
                    JSON.stringify(cleanedSchema);
                    result.schema = cleanedSchema;
                } catch (serializationError) {
                    console.warn('⚠️ Cleaned schema still cannot be serialized, using minimal schema');
                    // Create a minimal, safe schema that preserves essential information
                    result.schema = {
                        openapi: api.openapi,
                        info: api.info,
                        paths: api.paths ? breakCircularReferences(api.paths) : {},
                        components: api.components ? breakCircularReferences(api.components) : undefined,
                        servers: api.servers
                    } as OpenAPIV3.Document;
                    result.validationErrors.push('Warning: Schema was simplified due to complexity');
                }
            } catch (cleaningError) {
                console.warn('⚠️ Failed to clean circular references, using minimal schema:', cleaningError);                // Fallback: create a minimal schema with just the essential parts
                result.schema = {
                    openapi: api.openapi ?? '3.0.0',
                    info: api.info ?? { title: 'Unknown API', version: '1.0.0' },
                    paths: api.paths ?? {},
                    servers: api.servers
                } as OpenAPIV3.Document;
                result.validationErrors.push('Warning: Schema was simplified due to circular references');
            }

            // Try strict validation, but if it fails, still return the parsed schema
            try {
                await SwaggerParser.validate(api);
                console.log('✅ Schema passed strict validation');
            } catch (validationError) {
                const errorSummary = this.getValidationErrorSummary(validationError);
                console.warn('⚠️ Schema has validation warnings but can still be used:', errorSummary);
                result.isValid = false;
                result.validationErrors.push(errorSummary);
                // Continue with the parsed schema even if validation fails
                // This allows us to work with schemas that have minor issues
            }
            
            return result;
            
        } catch (error) {
            console.error('Schema parsing failed:', error);
              // If parsing completely fails, try to extract what we can
            if (typeof schemaData === 'object' && schemaData.openapi) {
                console.warn('⚠️ Using schema with limited parsing due to errors');
                // Clean the raw schema data too in case it has circular references
                const cleanedRawSchema = breakCircularReferences(schemaData);
                result.schema = cleanedRawSchema as OpenAPIV3.Document;
                result.isValid = false;
                result.validationErrors.push(this.getErrorMessage(error));
                return result;
            }
            
            throw error;
        }
    }    /**
     * Detect platform type from OpenAPI schema info
     * Analyzes schema title, description, and servers to identify known platforms
     */
    private detectPlatformFromSchema(schema: OpenAPIV3.Document): string {
        // Extract schema info safely
        const info = schema?.info ?? {};
        const title = (info.title ?? '').toLowerCase();
        const description = (info.description ?? '').toLowerCase();
        const servers = schema?.servers ?? [];
        
        // Check for Kibana indicators
        const kibanaIndicators = ['kibana'];
        if (kibanaIndicators.some(indicator => 
            title.includes(indicator) || 
            description.includes(indicator) ||
            servers.some((server: any) => (server.url ?? '').toLowerCase().includes(indicator))
        )) {
            console.log('🔍 Detected Kibana API from schema analysis');
            return 'kibana';
        }
        
        // Check for Elasticsearch indicators
        const elasticsearchIndicators = ['elasticsearch'];
        if (elasticsearchIndicators.some(indicator => 
            title.includes(indicator) || 
            description.includes(indicator) ||
            servers.some((server: any) => (server.url ?? '').toLowerCase().includes(indicator))
        )) {
            console.log('🔍 Detected Elasticsearch API from schema analysis');
            return 'elasticsearch';
        }
        
        // Default to generic
        console.log('🔍 Schema analysis: using generic platform configuration');
        return 'generic';
    }

    /**
     * Generate platform-specific request configuration based on detected platform
     */
    private generatePlatformConfig(platform: string): any {
        switch (platform) {
            case 'kibana':
                return {
                    platform: 'kibana',
                    requiredHeaders: {
                        'kbn-xsrf': 'true'
                    },
                    authConfig: {
                        headerFormat: 'Bearer'
                    },
                    sslConfig: {
                        allowSelfSigned: true,
                        notes: 'Kibana often uses self-signed certificates in development'
                    },
                    codeGenHints: {
                        comments: [
                            'Kibana requires kbn-xsrf header for API requests',
                            'This prevents CSRF attacks'
                        ],
                        errorHandling: 'Check for Kibana-specific error responses'
                    }
                };
            case 'elasticsearch':
                return {
                    platform: 'elasticsearch',
                    requiredHeaders: {},
                    authConfig: {
                        headerFormat: 'Bearer'
                    },
                    sslConfig: {
                        allowSelfSigned: true,
                        notes: 'Elasticsearch often uses self-signed certificates'
                    },
                    codeGenHints: {
                        comments: [
                            'Elasticsearch API endpoint',
                            'Supports various authentication methods'
                        ]
                    }
                };
            default:
                return {
                    platform: 'generic',
                    requiredHeaders: {},
                    authConfig: {
                        headerFormat: 'Bearer'
                    },
                    sslConfig: {
                        allowSelfSigned: false
                    },
                    codeGenHints: {
                        comments: ['Generic API endpoint']
                    }
                };
        }
    }

    /**
     * Get a summary of validation errors for logging
     * @param error The validation error
     */
    private getValidationErrorSummary(error: any): string {
        if (error.details && Array.isArray(error.details)) {
            const errorCount = error.details.length;
            const firstFewErrors = error.details.slice(0, 3).map((detail: any) => {                const path = detail.path ? detail.path.join('.') : 'unknown';
                return `${path}: ${detail.message ?? detail.code}`;
            });
            
            let summary = `${errorCount} validation issue(s) found`;
            if (firstFewErrors.length > 0) {
                summary += `: ${firstFewErrors.join(', ')}`;
                if (errorCount > 3) {
                    summary += ` (and ${errorCount - 3} more)`;
                }
            }
            return summary;
        } else if (error.message) {
            // Truncate very long error messages
            const message = error.message.length > 200 ? 
                error.message.substring(0, 200) + '...' : 
                error.message;
            return message;
        }
        return 'Unknown validation error';
    }
    
    /**
     * Extract API endpoints from a loaded schema
     * @param schema The parsed OpenAPI schema
     * @returns Array of API endpoints with their details
     */
    extractEndpoints(schema: OpenAPIV3.Document): ApiEndpoint[] {
        const endpoints: ApiEndpoint[] = [];
        
        // Loop through all paths in the schema
        if (schema.paths) {            Object.entries(schema.paths).forEach(([path, pathItem]) => {
                if (!pathItem) {
                    return;
                }
                
                // Each path can have multiple HTTP methods
                const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];
                
                methods.forEach(method => {
                    const operation = (pathItem as any)[method] as OpenAPIV3.OperationObject;
                    if (!operation) {
                        return;
                    }
                    
                    // Extract parameters from the operation
                    const parameters = this.extractParameters(operation.parameters, pathItem.parameters);
                    
                    const endpoint: ApiEndpoint = {
                        path,
                        method: method.toUpperCase(),
                        operationId: operation.operationId,
                        summary: operation.summary,
                        description: operation.description,
                        tags: operation.tags,
                        parameters,
                        requestBody: operation.requestBody,
                        responses: operation.responses
                    };
                    
                    endpoints.push(endpoint);
                });
            });
        }
        
        return endpoints;
    }
    
    /**
     * Extract and normalize parameters from an operation
     * @param operationParams Parameters defined on the operation
     * @param pathParams Parameters defined on the path (shared by all operations)
     */
    private extractParameters(
        operationParams?: (OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject)[],
        pathParams?: (OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject)[]
    ): ApiParameter[] {
        const parameters: ApiParameter[] = [];
        
        // Combine path-level and operation-level parameters
        const allParams = [...(pathParams || []), ...(operationParams || [])];
        
        allParams.forEach(param => {
            // Handle $ref parameters (we'd need to resolve these in a real implementation)
            if ('$ref' in param) {
                // For now, skip reference parameters
                // In a full implementation, we'd resolve these using the schema
                return;
            }
            
            const parameter: ApiParameter = {
                name: param.name,
                in: param.in as 'path' | 'query' | 'header' | 'cookie',
                required: param.required || param.in === 'path', // Path params are always required
                description: param.description,
                schema: param.schema,
                example: param.example
            };
            
            parameters.push(parameter);
        });
        
        return parameters;
    }
    
    /**
     * Get a user-friendly error message from an error object
     * @param error The error that occurred
     */
    private getErrorMessage(error: any): string {
        if (error.response) {
            // HTTP error
            return `HTTP ${error.response.status}: ${error.response.statusText}`;
        } else if (error.code === 'ENOTFOUND') {
            return 'Network error: Unable to reach the server';
        } else if (error.code === 'ECONNREFUSED') {
            return 'Connection refused: Server is not responding';
        } else if (error.name === 'SyntaxError') {
            return 'Invalid JSON/YAML format in schema';
        } else if (error.message) {
            return error.message;
        } else {
            return 'Unknown error occurred';
        }
    }
    
    /**
     * Get basic information about a schema without full parsing
     * @param schema The OpenAPI schema
     */
    getSchemaInfo(schema: OpenAPIV3.Document): {
        title: string;
        version: string;
        description?: string;
        serverCount: number;
        pathCount: number;
        endpointCount: number;
    } {
        const pathCount = schema.paths ? Object.keys(schema.paths).length : 0;
        
        // Count total endpoints (paths × methods)
        let endpointCount = 0;
        if (schema.paths) {
            Object.values(schema.paths).forEach(pathItem => {
                if (pathItem) {
                    const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];
                    endpointCount += methods.filter(method => (pathItem as any)[method]).length;
                }
            });
        }
          return {
            title: schema.info?.title ?? 'Untitled API',
            version: schema.info?.version ?? 'Unknown',
            description: schema.info?.description,
            serverCount: schema.servers?.length ?? 0,
            pathCount,
            endpointCount
        };
    }
}
