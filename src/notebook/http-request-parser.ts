/**
 * HttpRequestParser - Parses HTTP requests from notebook cell content
 * 
 * This class handles parsing HTTP request syntax from notebook cells,
 * including variable substitution and request validation.
 */

import { ParsedHttpRequest } from './http-request-executor';

/**
 * Context for variable substitution
 */
export interface VariableContext {
    [key: string]: any;
}

export class HttpRequestParser {
      /**
     * Parses an HTTP request from cell content with variable substitution
     */
    parseHttpRequest(content: string, variables: VariableContext = {}): ParsedHttpRequest {
        return this.parse(content, variables);
    }

    /**
     * Parses an HTTP request from cell content with variable substitution
     * (Alias method expected by tests)
     */
    parse(content: string, variables: VariableContext = {}): ParsedHttpRequest {
        // Substitute variables first
        const substitutedContent = this.substituteVariables(content, variables);
        
        // Split content into lines
        const lines = substitutedContent.split('\n').map(line => line.trim());
        
        // Parse request line (first non-empty line)
        const requestLineIndex = lines.findIndex(line => line.length > 0);
        if (requestLineIndex === -1) {
            throw new Error('No request line found');
        }
        
        const requestLine = lines[requestLineIndex];
        const { method, url } = this.parseRequestLine(requestLine);
        
        // Parse headers
        const headers: Record<string, string> = {};
        let bodyStart = -1;
        
        for (let i = requestLineIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            
            if (line === '') {
                // Empty line indicates start of body
                bodyStart = i + 1;
                break;
            }
            
            if (line.includes(':')) {
                const [key, ...valueParts] = line.split(':');
                headers[key.trim()] = valueParts.join(':').trim();
            }
        }
        
        // Parse body
        let body: string | undefined;
        if (bodyStart > -1 && bodyStart < lines.length) {
            const bodyLines = lines.slice(bodyStart).filter(line => line.length > 0);
            if (bodyLines.length > 0) {
                body = bodyLines.join('\n');
            }
        }
        
        return {
            method: method.toUpperCase(),
            url,
            headers,
            body
        };
    }

    /**
     * Parses the request line (method and URL)
     */
    private parseRequestLine(line: string): { method: string; url: string } {
        const parts = line.split(/\s+/);
        
        if (parts.length < 2) {
            throw new Error(`Invalid request line: ${line}`);
        }
        
        const method = parts[0];
        const url = parts[1];
        
        if (!this.isValidHttpMethod(method)) {
            throw new Error(`Invalid HTTP method: ${method}`);
        }
        
        return { method, url };
    }

    /**
     * Substitutes variables in the content using {{variable}} syntax
     */
    private substituteVariables(content: string, variables: VariableContext): string {
        return content.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
            if (variableName in variables) {
                const value = variables[variableName];
                return typeof value === 'string' ? value : JSON.stringify(value);
            }
            return match; // Keep original if variable not found
        });
    }

    /**
     * Validates HTTP method
     */
    private isValidHttpMethod(method: string): boolean {
        const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
        return validMethods.includes(method.toUpperCase());
    }

    /**
     * Validates URL format
     */
    validateUrl(url: string): boolean {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Extracts variables used in the content
     */
    extractVariables(content: string): string[] {
        const matches = content.match(/\{\{(\w+)\}\}/g);
        if (!matches) {
            return [];
        }
        
        return matches
            .map(match => match.slice(2, -2)) // Remove {{ and }}
            .filter((value, index, array) => array.indexOf(value) === index); // Remove duplicates
    }

    /**
     * Validates request syntax without executing
     */
    validateSyntax(content: string): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        try {
            // Try to parse with empty variables to check syntax
            this.parseHttpRequest(content, {});
        } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Generates a template HTTP request for an endpoint
     */
    generateTemplate(method: string, path: string, baseUrl = '{{baseUrl}}'): string {
        let template = `${method.toUpperCase()} ${baseUrl}${path}\n`;
        
        // Add common headers
        template += 'Content-Type: application/json\n';
        
        // Add auth header placeholder
        template += 'Authorization: Bearer {{token}}\n';
        
        // Add body for methods that typically have one
        if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
            template += '\n{\n  "example": "value"\n}';
        }
        
        return template;
    }
}
