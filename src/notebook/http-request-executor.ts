/**
 * HttpRequestExecutor - Executes HTTP requests from notebook cells
 * 
 * This class handles the execution of HTTP requests parsed from notebook cells,
 * including authentication, environment variable substitution, and response handling.
 */

import { ConfigurationManager } from '../configuration';

/**
 * Represents a parsed HTTP request ready for execution
 */
export interface ParsedHttpRequest {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
    metadata?: Record<string, any>;
}

/**
 * Represents the result of an HTTP request execution
 */
export interface HttpExecutionResult {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: any;
    body?: string;
    success?: boolean;
    contentType?: string;
    parsedBody?: any;
    timing: {
        start: number;
        end: number;
        duration: number;
    } | number; // Support both formats for backward compatibility
    error?: string;
}

export class HttpRequestExecutor {
    constructor(private readonly configManager?: ConfigurationManager) {}

    /**
     * Executes a parsed HTTP request
     */    async executeRequest(request: ParsedHttpRequest): Promise<HttpExecutionResult> {
        const start = Date.now();
        try {
            // Apply authentication
            const authenticatedRequest = await this.applyAuthentication(request);
            
            // Make the HTTP request
            const response = await this.makeHttpRequest(authenticatedRequest);
              const responseData = await this.parseResponseData(response);
            const responseHeaders = this.extractHeaders(response);
            const fullContentType = responseHeaders['content-type'] || '';
            const contentType = fullContentType.split(';')[0].trim(); // Extract just the media type
            
            const end = Date.now();
            
            return {
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders,
                data: responseData,
                body: typeof responseData === 'string' ? responseData : JSON.stringify(responseData),
                success: response.status >= 200 && response.status < 300,
                contentType,
                parsedBody: contentType.includes('application/json') ? responseData : undefined,
                timing: end - start // Support timing as number for compatibility
            };
        } catch (error) {
            const end = Date.now();
            
            return {
                status: 0,
                statusText: 'Error',
                headers: {},
                data: null,
                body: '',
                success: false,
                timing: end - start,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Executes a parsed HTTP request (alias method expected by tests)
     */
    async execute(request: ParsedHttpRequest): Promise<HttpExecutionResult> {
        return this.executeRequest(request);
    }    /**
     * Applies authentication to the request based on environment configuration
     */
    private async applyAuthentication(request: ParsedHttpRequest): Promise<ParsedHttpRequest> {
        // If no environment metadata, return request as-is
        if (!request.metadata?.environmentId || !this.configManager) {
            return request;
        }

        try {
            // Get environment configuration
            const config = await this.configManager.resolveEnvironmentConfig(request.metadata.environmentId);
            if (!config) {
                return request;
            }

            // Merge headers with environment headers
            const mergedHeaders = {
                ...config.resolvedHeaders,
                ...request.headers
            };

            // Get credentials from secret storage
            const credentials = await this.configManager.getCredentials(config.environment);

            // Add authentication headers from environment config and credentials
            if (config.resolvedAuth && credentials) {
                switch (config.resolvedAuth.type) {
                    case 'bearer':
                        if (credentials.apiKey) {
                            mergedHeaders['Authorization'] = `Bearer ${credentials.apiKey}`;
                        }
                        break;
                    
                    case 'apikey':
                        if (credentials.apiKey) {
                            const keyName = config.resolvedAuth.apiKeyName ?? 'X-API-Key';
                            mergedHeaders[keyName] = credentials.apiKey;
                        }
                        break;
                    
                    case 'basic':
                        if (credentials.username && credentials.password) {
                            const authString = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
                            mergedHeaders['Authorization'] = `Basic ${authString}`;
                        }
                        break;
                }
            }

            return {
                ...request,
                headers: mergedHeaders
            };
        } catch (error) {
            // If authentication fails, log and return original request
            console.error('Failed to apply authentication:', error);
            return request;
        }
    }

    /**
     * Makes the actual HTTP request using node-fetch or similar
     */
    private async makeHttpRequest(request: ParsedHttpRequest): Promise<Response> {
        const fetchOptions: RequestInit = {
            method: request.method,
            headers: request.headers
        };

        if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method.toUpperCase())) {
            fetchOptions.body = request.body;
        }

        // Use the global fetch if available, otherwise simulate
        if (typeof fetch !== 'undefined') {
            return await fetch(request.url, fetchOptions);
        } else {
            // Simulate a response for testing/development
            return this.simulateResponse(request);
        }
    }

    /**
     * Simulates an HTTP response for testing purposes
     */
    private simulateResponse(request: ParsedHttpRequest): Response {
        const mockResponse = {
            status: 200,
            statusText: 'OK',
            headers: new Headers({
                'content-type': 'application/json',
                'x-simulated': 'true'
            }),
            json: async () => ({
                message: 'Simulated response',
                request: {
                    method: request.method,
                    url: request.url,
                    headers: request.headers
                },
                timestamp: new Date().toISOString()
            }),
            text: async () => JSON.stringify({
                message: 'Simulated response',
                request: {
                    method: request.method,
                    url: request.url,
                    headers: request.headers
                },
                timestamp: new Date().toISOString()
            })
        } as Response;

        return mockResponse;
    }

    /**
     * Extracts headers from the response
     */
    private extractHeaders(response: Response): Record<string, string> {
        const headers: Record<string, string> = {};
        
        if (response.headers) {
            response.headers.forEach((value, key) => {
                headers[key] = value;
            });
        }
        
        return headers;
    }

    /**
     * Parses response data based on content type
     */
    private async parseResponseData(response: Response): Promise<any> {
        const contentType = response.headers.get('content-type') ?? '';
        
        if (contentType.includes('application/json')) {
            try {
                return await response.json();
            } catch {
                return await response.text();
            }
        } else if (contentType.includes('text/')) {
            return await response.text();
        } else {
            // For binary data or unknown types, return basic info
            return {
                contentType,
                size: response.headers.get('content-length') ?? 'unknown'
            };
        }
    }

    /**
     * Validates that a request is properly formed
     */
    validateRequest(request: ParsedHttpRequest): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!request.method) {
            errors.push('HTTP method is required');
        }

        if (!request.url) {
            errors.push('URL is required');
        }

        try {
            new URL(request.url);
        } catch {
            errors.push('Invalid URL format');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}
