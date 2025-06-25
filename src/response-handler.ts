import * as vscode from 'vscode';

export class ResponseHandler {
    private static readonly MAX_INLINE_SIZE = 100 * 1024; // 100KB
    private static readonly PREVIEW_LINES = 50;    private static readonly responseCache = new Map<string, string>();

    static async handleApiResponse(response: any, uri: vscode.Uri): Promise<vscode.NotebookCellOutput> {
        let jsonString: string;
        
        try {
            jsonString = JSON.stringify(response, null, 2);
        } catch (error) {
            // Handle circular references or other JSON stringify errors
            console.warn('Failed to stringify response, using fallback:', error);
            jsonString = JSON.stringify({ 
                error: 'Unable to display response', 
                reason: 'Circular reference or non-serializable content',
                type: typeof response 
            }, null, 2);
        }

        const sizeInBytes = Buffer.byteLength(jsonString, 'utf8');

        if (sizeInBytes > this.MAX_INLINE_SIZE) {
            return this.createTruncatedOutput(jsonString, sizeInBytes, uri);
        } else {
            return this.createNormalOutput(jsonString);
        }
    }

    private static createTruncatedOutput(jsonString: string, sizeInBytes: number, uri: vscode.Uri): vscode.NotebookCellOutput {
        const lines = jsonString.split('\n');
        const truncatedLines = lines.slice(0, this.PREVIEW_LINES);
        const remainingLines = lines.length - this.PREVIEW_LINES;
        
        const previewJson = truncatedLines.join('\n');
        const sizeFormatted = this.formatFileSize(sizeInBytes);

        // Store the full response with a unique ID for later retrieval
        const responseId = `response_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        ResponseHandler.storeTemporaryResponse(responseId, jsonString);

        // Create HTML with preview and "Open Full Response" button (NO embedded data)
        const html = `
            <div style="font-family: var(--vscode-editor-font-family);">
                <div style="background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 8px; margin-bottom: 10px; border-radius: 3px; display: flex; align-items: center; justify-content: space-between;">
                    <span>⚠️ Large Response (${sizeFormatted}) - Showing first ${this.PREVIEW_LINES} lines</span>
                    <button onclick="openFullResponse('${responseId}')" style="padding: 4px 12px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">
                        📄 Open Full Response
                    </button>
                </div>
                <pre style="background: var(--vscode-textCodeBlock-background); padding: 10px; border-radius: 3px; overflow-x: auto; max-height: 400px; overflow-y: auto;"><code>${this.escapeHtml(previewJson)}</code></pre>
                <div style="color: var(--vscode-descriptionForeground); font-style: italic; margin-top: 10px; text-align: center;">
                    ... and ${remainingLines.toLocaleString()} more lines (${sizeFormatted} total)
                </div>
            </div>
            <script>
                function openFullResponse(responseId) {
                    const vscode = acquireVsCodeApi();
                    vscode.postMessage({
                        command: 'executeCommand',
                        commandId: 'pathfinder.openFullResponse',
                        args: [responseId]
                    });
                }
            </script>
        `;

        return new vscode.NotebookCellOutput([
            vscode.NotebookCellOutputItem.text(html, 'text/html')
        ]);
    }

    private static createNormalOutput(jsonString: string): vscode.NotebookCellOutput {
        const html = `
            <div style="font-family: var(--vscode-editor-font-family);">
                <pre style="background: var(--vscode-textCodeBlock-background); padding: 10px; border-radius: 3px; overflow-x: auto; max-height: 400px; overflow-y: auto;"><code>${this.escapeHtml(jsonString)}</code></pre>
            </div>
        `;

        return new vscode.NotebookCellOutput([
            vscode.NotebookCellOutputItem.text(html, 'text/html')
        ]);
    }    private static escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }    private static formatFileSize(bytes: number): string {
        if (bytes === 0) {
            return '0 Bytes';
        }
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * Store a response in the temporary cache for later retrieval
     */
    static storeTemporaryResponse(responseId: string, responseData: string): void {
        this.responseCache.set(responseId, responseData);
        
        // Clean up old responses (keep only the latest 50)
        if (this.responseCache.size > 50) {
            const keysToDelete = Array.from(this.responseCache.keys()).slice(0, this.responseCache.size - 50);
            keysToDelete.forEach(key => this.responseCache.delete(key));
        }
    }

    /**
     * Retrieve a stored response by its ID
     */
    static getStoredResponse(responseId: string): string | undefined {
        return this.responseCache.get(responseId);
    }

    /**
     * Clear all stored responses
     */
    static clearStoredResponses(): void {
        this.responseCache.clear();
    }

    /**
     * Get the count of stored responses
     */
    static getStoredResponseCount(): number {
        return this.responseCache.size;
    }

    /**
     * Open a stored response in a new editor tab
     */
    static async openFullResponseInEditor(responseId: string): Promise<void> {
        try {
            // Try to get the response from our cache first
            let content = this.getStoredResponse(responseId);
            
            if (!content) {
                // Fallback: maybe it's base64 encoded content (backward compatibility)
                if (/^[A-Za-z0-9+/]*={0,2}$/.test(responseId) && responseId.length > 100) {
                    try {
                        content = Buffer.from(responseId, 'base64').toString('utf8');
                    } catch {
                        throw new Error('Response not found and not valid base64');
                    }
                } else {
                    throw new Error('Response not found in cache');
                }
            }
            
            const doc = await vscode.workspace.openTextDocument({
                content: content,
                language: 'json'
            });
            
            await vscode.window.showTextDocument(doc, {
                viewColumn: vscode.ViewColumn.Beside,
                preview: false
            });

            // Show a status message
            vscode.window.showInformationMessage('Full API response opened in new editor tab');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open response: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
