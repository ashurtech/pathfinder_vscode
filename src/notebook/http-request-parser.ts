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
     */    parse(content: string, variables: VariableContext = {}): ParsedHttpRequest {
        // Substitute variables first
        const substitutedContent = this.substituteVariables(content, variables);
        const lines = substitutedContent.split('\n');
          // Get non-comment lines for parsing structure
        const nonCommentLines = this.filterNonCommentLines(lines);
        if (nonCommentLines.length === 0) {
            throw new Error('No request line found');
        }
          // Find first non-empty line for request line
        const requestLineIndex = nonCommentLines.findIndex(item => item.line.trim() !== '');
        if (requestLineIndex === -1) {
            throw new Error('No request line found');
        }
        
        // Parse request line
        const { method, url } = this.parseRequestLine(nonCommentLines[requestLineIndex].line);
        
        // Parse headers and find body start
        const { headers, bodyStartIndex } = this.parseHeaders(nonCommentLines, requestLineIndex);
        
        // Parse body preserving original formatting
        const body = this.parseBody(lines, bodyStartIndex);
        
        return {
            method: method.toUpperCase(),
            url,
            headers,
            body
        };
    }    /**
     * Filters out comment-only lines and returns line info, preserving empty lines for header parsing
     */
    private filterNonCommentLines(lines: string[]): { line: string; originalIndex: number }[] {
        const nonCommentLines: { line: string; originalIndex: number }[] = [];
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            // Keep empty lines (for header/body separation) and non-comment lines
            if (trimmed === '' || !trimmed.startsWith('#')) {
                nonCommentLines.push({ line: trimmed, originalIndex: index });
            }
        });
        return nonCommentLines;
    }    /**
     * Parses headers and determines body start index
     */
    private parseHeaders(nonCommentLines: { line: string; originalIndex: number }[], requestLineIndex: number): {
        headers: Record<string, string>;
        bodyStartIndex: number;
    } {
        const headers: Record<string, string> = {};
        let bodyStartIndex = -1;
        
        // Start after the request line
        for (let i = requestLineIndex + 1; i < nonCommentLines.length; i++) {
            const lineItem = nonCommentLines[i];
            const line = lineItem.line;
            
            if (line === '') {
                bodyStartIndex = lineItem.originalIndex + 1;
                break;
            }
            if (line.includes(':')) {
                const colonIndex = line.indexOf(':');
                const key = line.substring(0, colonIndex).trim();
                let value = line.substring(colonIndex + 1).trim();
                
                // Strip inline comments from header values
                const commentIndex = value.indexOf('#');
                if (commentIndex !== -1) {
                    value = value.substring(0, commentIndex).trim();
                }
                
                headers[key] = value;
            } else {
                bodyStartIndex = lineItem.originalIndex;
                break;
            }
        }
        
        return { headers, bodyStartIndex };
    }

    /**
     * Parses body content preserving original formatting
     */
    private parseBody(lines: string[], bodyStartIndex: number): string | undefined {
        if (bodyStartIndex <= -1 || bodyStartIndex >= lines.length) {
            return undefined;
        }
        
        const bodyLines = lines.slice(bodyStartIndex);
        
        // Remove leading empty lines
        let startIdx = 0;
        while (startIdx < bodyLines.length && bodyLines[startIdx].trim() === '') {
            startIdx++;
        }
        
        // Remove trailing empty lines
        let endIdx = bodyLines.length - 1;
        while (endIdx >= startIdx && bodyLines[endIdx].trim() === '') {
            endIdx--;
        }
        
        if (startIdx <= endIdx) {
            return bodyLines.slice(startIdx, endIdx + 1).join('\n');
        }
        
        return undefined;
    }/**
     * Parses the request line (method and URL)
     */
    private parseRequestLine(line: string): { method: string; url: string } {
        // Remove comments and trim
        const cleanLine = line.split('#')[0].trim();
        const parts = cleanLine.split(/\s+/);
        
        if (parts.length < 2) {
            throw new Error(`Invalid HTTP request format. Expected: METHOD URL, got: ${line}`);
        }
        
        const method = parts[0];
        const url = parts[1];
        
        if (!this.isValidHttpMethod(method)) {
            throw new Error(`Invalid HTTP method: ${method}. Valid methods: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS`);
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
