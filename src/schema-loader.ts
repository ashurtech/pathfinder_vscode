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
            } else if (environment.auth.type === 'apikey' && environment.auth.apiKey) {
                if (environment.auth.apiKeyLocation === 'header') {
                    headers[environment.auth.apiKeyName || 'X-API-Key'] = environment.auth.apiKey;
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
            });
            
            // Parse and validate the schema using swagger-parser
            const parsedSchema = await this.parseAndValidateSchema(response.data);
            
            return {
                environmentId: environment.id,
                schema: parsedSchema,
                source: url,
                loadedAt: new Date(),
                isValid: true,
                validationErrors: []
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
            }
            
            // Parse and validate the schema
            const parsedSchema = await this.parseAndValidateSchema(schemaData);
            
            return {
                environmentId: environment.id,
                schema: parsedSchema,
                source: filePath,
                loadedAt: new Date(),
                isValid: true,
                validationErrors: []
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
    }
    
    /**
     * Parse and validate an OpenAPI schema using swagger-parser
     * @param schemaData The raw schema data (object or string)
     */
    private async parseAndValidateSchema(schemaData: any): Promise<OpenAPIV3.Document> {
        try {            // swagger-parser does all the heavy lifting:
            // - Validates the schema against OpenAPI specification
            // - Resolves $ref references (including external ones)
            // - Converts OpenAPI 2.0 (Swagger) to OpenAPI 3.0 if needed
            const api = await SwaggerParser.validate(schemaData);
            
            // Ensure we have an OpenAPI 3.x document
            if (!api.openapi?.startsWith('3.')) {
                throw new Error('Only OpenAPI 3.x specifications are supported');
            }
            
            return api;
            
        } catch (error) {
            console.error('Schema validation failed:', error);
            throw error;
        }
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
            title: schema.info?.title || 'Untitled API',
            version: schema.info?.version || 'Unknown',
            description: schema.info?.description,
            serverCount: schema.servers?.length || 0,
            pathCount,
            endpointCount
        };
    }
}
