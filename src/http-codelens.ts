/**
 * CodeLens Provider for HTTP Request Files
 * 
 * This provider adds "▶ Run Request" buttons above HTTP requests in editors
 */

import * as vscode from 'vscode';
import { HttpRequestRunner } from './http-runner';

export class HttpCodeLensProvider implements vscode.CodeLensProvider {
    private readonly httpRunner: HttpRequestRunner;

    constructor(httpRunner: HttpRequestRunner) {
        this.httpRunner = httpRunner;
    }    /**
     * Provide CodeLens for HTTP files
     */
    provideCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.CodeLens[] | Promise<vscode.CodeLens[]> {
        const codeLenses: vscode.CodeLens[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        // Find HTTP request lines (e.g., "GET https://api.example.com/users")
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Add "Run Request" CodeLens for HTTP method lines
            const httpMethodRegex = /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE)\s+(\S+)/i;
            const httpMethodMatch = httpMethodRegex.exec(line);
            
            if (httpMethodMatch) {
                const range = new vscode.Range(i, 0, i, line.length);
                const runCodeLens = new vscode.CodeLens(range, {
                    title: '▶ Run Request',
                    command: 'pathfinder.executeHttpRequest',
                    arguments: [document.uri, i]
                });
                codeLenses.push(runCodeLens);
            }
            
            // Add "Toggle Auth Visibility" CodeLens for authorization headers with eye icons
            const authWithEyeRegex = /^(Authorization|X-API-Key):.+# 👁️ Click to toggle visibility/i;
            const authWithEyeMatch = authWithEyeRegex.exec(line);
            
            if (authWithEyeMatch) {
                const range = new vscode.Range(i, 0, i, line.length);
                const eyeCodeLens = new vscode.CodeLens(range, {
                    title: '👁️ Toggle Visibility',
                    command: 'pathfinder.toggleAuthVisibility',
                    arguments: [document.uri]
                });
                codeLenses.push(eyeCodeLens);
            }
        }

        // Add general auth toggle if document has masked or unmasked auth
        if (this.httpRunner.hasMaskedAuth(text) || this.httpRunner.hasUnmaskedAuth(text)) {
            // Add at the top of the document
            const topRange = new vscode.Range(0, 0, 0, 0);
            const toggleAllCodeLens = new vscode.CodeLens(topRange, {
                title: this.httpRunner.hasMaskedAuth(text) ? '🔓 Reveal All Auth' : '🔒 Hide All Auth',
                command: 'pathfinder.toggleAuthVisibility',
                arguments: [document.uri]
            });
            codeLenses.push(toggleAllCodeLens);
        }

        return codeLenses;
    }

    /**
     * Resolve CodeLens (optional)
     */
    resolveCodeLens(
        codeLens: vscode.CodeLens,
        token: vscode.CancellationToken
    ): vscode.CodeLens | Promise<vscode.CodeLens> {
        return codeLens;
    }
}
