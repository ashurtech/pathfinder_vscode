import * as vscode from 'vscode';
import { ConfigurationManager } from './configuration';
import { SchemaEnvironment } from './types';

export class CodeGenerationCommands {
    constructor(private readonly configManager: ConfigurationManager) {}

    async generateCurl(treeItemOrEndpoint: any, schemaItemWithEnv?: any) {
        const { environment, endpoint } = await this.getContextFromArgs(treeItemOrEndpoint, schemaItemWithEnv);
        if (!environment || !endpoint) {
            return;
        }

        const curlCommand = await this.buildCurlCommand(endpoint, environment);
        await this.insertOrShowCode(curlCommand, 'shell');
    }

    async generatePython(treeItemOrEndpoint: any, schemaItemWithEnv?: any) {
        const { environment, endpoint } = await this.getContextFromArgs(treeItemOrEndpoint, schemaItemWithEnv);
        if (!environment || !endpoint) {
            return;
        }

        const pythonCode = await this.buildPythonCode(endpoint, environment);
        await this.insertOrShowCode(pythonCode, 'python');
    }

    async generateJavaScript(treeItemOrEndpoint: any, schemaItemWithEnv?: any) {
        const { environment, endpoint } = await this.getContextFromArgs(treeItemOrEndpoint, schemaItemWithEnv);
        if (!environment || !endpoint) {
            return;
        }

        const jsCode = await this.buildJavaScriptCode(endpoint, environment);
        await this.insertOrShowCode(jsCode, 'javascript');
    }

    private async getContextFromArgs(treeItemOrEndpoint: any, schemaItemWithEnv?: any): Promise<{
        environment: SchemaEnvironment | null,
        endpoint: any
    }> {
        // Handle new calling convention (tree item with context)
        if (treeItemOrEndpoint?.environmentId && treeItemOrEndpoint?.endpointData) {
            return this.getContextFromTreeItem(treeItemOrEndpoint);
        }

        // Handle old calling convention (endpoint + schemaItemWithEnvironment)
        if (schemaItemWithEnv?.environment) {
            return {
                environment: schemaItemWithEnv.environment,
                endpoint: treeItemOrEndpoint
            };
        }

        vscode.window.showErrorMessage('Unable to determine environment context for code generation');
        return { environment: null, endpoint: {} };
    }

    private async getContextFromTreeItem(treeItem: any): Promise<{
        environment: SchemaEnvironment | null,
        endpoint: any
    }> {
        // Check if we have the required context
        if (!treeItem?.environmentId || !treeItem?.endpointData) {
            vscode.window.showErrorMessage('Unable to determine environment context for code generation');
            return { environment: null, endpoint: {} };
        }

        try {
            // Get the environment directly by ID
            const schemas = await this.configManager.getApiSchemas();
            let environment: SchemaEnvironment | undefined;

            for (const schema of schemas) {
                const environments = await this.configManager.getSchemaEnvironments(schema.id);
                environment = environments.find(env => env.id === treeItem.environmentId);
                if (environment) {
                    break;
                }
            }

            if (!environment) {
                vscode.window.showErrorMessage('Environment not found. Please refresh the tree view.');
                return { environment: null, endpoint: {} };
            }

            return {
                environment,
                endpoint: treeItem.endpointData
            };

        } catch (error) {
            console.error('Failed to get environment context:', error);
            vscode.window.showErrorMessage('Failed to load environment data');
            return { environment: null, endpoint: {} };
        }
    }

    private async buildCurlCommand(endpoint: any, environment: SchemaEnvironment): Promise<string> {
        const method = endpoint.method?.toUpperCase() ?? 'GET';
        const path = endpoint.path ?? '';
        const url = `${environment.baseUrl.replace(/\/$/, '')}${path}`;

        let curl = `curl -X ${method} "${url}"`;

        // Add authentication headers
        const auth = await this.getAuthHeaders(environment);
        for (const [header, value] of Object.entries(auth.headers)) {
            curl += ` \\\n  -H "${header}: ${value}"`;
        }

        // Add query parameters to URL if needed
        if (Object.keys(auth.queryParams).length > 0) {
            const queryString = new URLSearchParams(auth.queryParams).toString();
            curl = curl.replace(`"${url}"`, `"${url}?${queryString}"`);
        }

        // Add Content-Type header for POST/PUT requests with body
        if (['POST', 'PUT', 'PATCH'].includes(method) && endpoint.requestBody) {
            curl += ` \\\n  -H "Content-Type: application/json"`;
            const sampleBody = this.generateSampleRequestBody(endpoint.requestBody);
            curl += ` \\\n  -d '${JSON.stringify(sampleBody, null, 2)}'`;
        }

        return curl;
    }

    private async buildPythonCode(endpoint: any, environment: SchemaEnvironment): Promise<string> {
        const method = endpoint.method?.toLowerCase() ?? 'get';
        const path = endpoint.path ?? '';
        const url = `${environment.baseUrl.replace(/\/$/, '')}${path}`;

        const auth = await this.getAuthHeaders(environment);

        let code = `import requests\nimport json\n\n`;
        const methodUpper = method.toUpperCase();
        const summary = endpoint.summary ?? `${methodUpper} ${path}`;
        code += `# ${summary}\n`;
        code += `url = "${url}"\n\n`;

        // Headers
        const headers = { ...auth.headers };
        if (['post', 'put', 'patch'].includes(method) && endpoint.requestBody) {
            headers['Content-Type'] = 'application/json';
        }

        if (Object.keys(headers).length > 0) {
            code += `headers = ${JSON.stringify(headers, null, 4)}\n\n`;
        }

        // Query parameters
        if (Object.keys(auth.queryParams).length > 0) {
            code += `params = ${JSON.stringify(auth.queryParams, null, 4)}\n\n`;
        }

        // Request body
        if (['post', 'put', 'patch'].includes(method) && endpoint.requestBody) {
            const sampleBody = this.generateSampleRequestBody(endpoint.requestBody);
            code += `data = ${JSON.stringify(sampleBody, null, 4)}\n\n`;
        }        // Make the request
        const requestParams = ['url'];
        if (Object.keys(headers).length > 0) {
            requestParams.push('headers=headers');
        }
        if (Object.keys(auth.queryParams).length > 0) {
            requestParams.push('params=params');
        }
        if (['post', 'put', 'patch'].includes(method) && endpoint.requestBody) {
            requestParams.push('json=data');
        }

        code += `response = requests.${method}(${requestParams.join(', ')})\n`;
        code += `print(f"Status Code: {response.status_code}")\n`;
        code += `print(f"Response: {response.text}")\n`;

        return code;
    }

    private async buildJavaScriptCode(endpoint: any, environment: SchemaEnvironment): Promise<string> {
        const method = endpoint.method?.toUpperCase() ?? 'GET';
        const path = endpoint.path ?? '';
        const url = `${environment.baseUrl.replace(/\/$/, '')}${path}`;

        const auth = await this.getAuthHeaders(environment);

        const summary = endpoint.summary ?? `${method} ${path}`;
        let code = `// ${summary}\n`;
        code += `const url = "${url}";\n\n`;

        // Build headers
        const headers = { ...auth.headers };
        if (['POST', 'PUT', 'PATCH'].includes(method) && endpoint.requestBody) {
            headers['Content-Type'] = 'application/json';
        }

        if (Object.keys(headers).length > 0) {
            code += `const headers = ${JSON.stringify(headers, null, 4)};\n\n`;
        }

        // Build request options
        code += `const options = {\n`;
        code += `    method: "${method}",\n`;
        if (Object.keys(headers).length > 0) {
            code += `    headers: headers,\n`;
        }

        // Add body for POST/PUT/PATCH requests
        if (['POST', 'PUT', 'PATCH'].includes(method) && endpoint.requestBody) {
            const sampleBody = this.generateSampleRequestBody(endpoint.requestBody);
            code += `    body: JSON.stringify(${JSON.stringify(sampleBody, null, 8)})\n`;
        }

        code += `};\n\n`;

        // Add query parameters to URL if needed
        let finalUrl = url;
        if (Object.keys(auth.queryParams).length > 0) {
            const queryString = new URLSearchParams(auth.queryParams).toString();
            finalUrl = `${url}?${queryString}`;
        }

        code += `fetch("${finalUrl}", options)\n`;
        code += `    .then(response => {\n`;
        code += `        console.log('Status:', response.status);\n`;
        code += `        return response.json();\n`;
        code += `    })\n`;
        code += `    .then(data => {\n`;
        code += `        console.log('Response:', data);\n`;
        code += `    })\n`;
        code += `    .catch(error => {\n`;
        code += `        console.error('Error:', error);\n`;
        code += `    });\n`;

        return code;
    }

    private generateSampleRequestBody(requestBodySpec: any): any {
        if (!requestBodySpec?.content) {
            return {};
        }

        const jsonContent = requestBodySpec.content['application/json'];
        if (jsonContent?.schema) {
            return this.generateSampleFromSchema(jsonContent.schema);
        }

        return {};
    }

    private generateSampleFromSchema(schema: any): any {
        if (schema.type === 'object' && schema.properties) {
            const result: any = {};
            for (const [propName, propSchema] of Object.entries(schema.properties)) {
                result[propName] = this.generateSampleValue(propSchema);
            }
            return result;
        }
        return this.generateSampleValue(schema);
    }

    private generateSampleValue(schema: any): any {
        if (schema.example !== undefined) {
            return schema.example;
        }

        switch (schema.type) {
            case 'string':
                return schema.example ?? 'string';
            case 'number':
            case 'integer':
                return schema.example ?? 0;
            case 'boolean':
                return schema.example ?? true;
            case 'array':
                return schema.example ?? [];
            case 'object':
                return this.generateSampleFromSchema(schema);
            default:
                return schema.example ?? null;
        }
    }

    private async getAuthHeaders(environment: SchemaEnvironment): Promise<{ headers: Record<string, string>, queryParams: Record<string, string> }> {
        const result: { headers: Record<string, string>, queryParams: Record<string, string> } = {
            headers: {},
            queryParams: {}
        };

        if (!environment.auth) {
            return result;
        }        switch (environment.auth.type) {
            case 'apikey': {
                if (environment.auth.apiKeyLocation === 'header') {
                    const headerName = environment.auth.apiKeyName ?? 'X-API-Key';
                    const apiKey = await this.getSecretValue(environment.auth.apiKey ?? '');
                    if (apiKey) {
                        result.headers[headerName] = apiKey;
                    }
                } else if (environment.auth.apiKeyLocation === 'query') {
                    const paramName = environment.auth.apiKeyName ?? 'api_key';
                    const apiKey = await this.getSecretValue(environment.auth.apiKey ?? '');
                    if (apiKey) {
                        result.queryParams[paramName] = apiKey;
                    }
                }
                break;
            }

            case 'bearer': {
                const token = await this.getSecretValue(environment.auth.bearerToken ?? '');
                if (token) {
                    result.headers['Authorization'] = `Bearer ${token}`;
                }
                break;
            }

            case 'basic': {
                const username = environment.auth.username ?? '';
                const password = await this.getSecretValue(environment.auth.password ?? '');
                if (username && password) {
                    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
                    result.headers['Authorization'] = `Basic ${credentials}`;
                }
                break;
            }
        }

        // Add custom headers from environment
        if (environment.customHeaders) {
            Object.assign(result.headers, environment.customHeaders);
        }

        return result;
    }

    private async getSecretValue(secretKey: string): Promise<string> {
        if (!secretKey) {
            return '';
        }

        // If it's already a plain value (not a secret reference)
        if (!secretKey.startsWith('${') || !secretKey.endsWith('}')) {
            return secretKey;
        }

        // Extract the secret key from ${SECRET_NAME} format
        const key = secretKey.slice(2, -1);
        return vscode.workspace.getConfiguration('pathfinder').get(`secrets.${key}`, '');
    }

    private async insertOrShowCode(code: string, language: string) {
        // Try to insert into active editor if it's empty or supported
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && (activeEditor.document.getText().trim() === '' || activeEditor.document.languageId === language)) {
            await activeEditor.edit(editBuilder => {
                editBuilder.insert(activeEditor.selection.start, code);
            });
            return;
        }

        // Otherwise, open a new document
        const document = await vscode.workspace.openTextDocument({
            content: code,
            language: language
        });
        await vscode.window.showTextDocument(document);
    }
}

// Export factory functions for backward compatibility
export function createCodeGenerationCommand() {
    return (treeItemOrEndpoint: any, schemaItemWithEnv?: any) => {
        // This is a placeholder - the actual implementation should be done by extension.ts
        // when it creates the CodeGenerationCommands instance
        vscode.window.showErrorMessage('Code generation commands not properly initialized');
    };
}

export function generateCurlCommand(treeItemOrEndpoint: any, schemaItemWithEnv?: any) {
    return createCodeGenerationCommand()(treeItemOrEndpoint, schemaItemWithEnv);
}

export function generatePythonCode(treeItemOrEndpoint: any, schemaItemWithEnv?: any) {
    return createCodeGenerationCommand()(treeItemOrEndpoint, schemaItemWithEnv);
}

export function generateJavaScriptCode(treeItemOrEndpoint: any, schemaItemWithEnv?: any) {
    return createCodeGenerationCommand()(treeItemOrEndpoint, schemaItemWithEnv);
}
