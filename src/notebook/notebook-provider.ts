/**
 * NotebookProvider - Handles serialization and deserialization of notebook documents
 * 
 * This class manages the storage format for Pathfinder HTTP notebooks,
 * including XML-based cell serialization and metadata handling.
 */

import * as vscode from 'vscode';

/**
 * Custom notebook provider for Pathfinder HTTP notebooks
 */
export class NotebookProvider implements vscode.NotebookSerializer {
    
    /**
     * Deserializes notebook content from disk into VS Code notebook format
     */
    async deserializeNotebook(
        content: Uint8Array,
        _token: vscode.CancellationToken
    ): Promise<vscode.NotebookData> {
        const contentStr = Buffer.from(content).toString('utf8');
        
        try {
            // Parse XML-based notebook format
            const notebookData = this.parseXmlNotebook(contentStr);
            return notebookData;
        } catch (error) {
            // If parsing fails, create a basic notebook with the content as a single cell
            const errorCell = new vscode.NotebookCellData(
                vscode.NotebookCellKind.Markup,
                `# Parse Error\n\nFailed to parse notebook: ${error instanceof Error ? error.message : String(error)}\n\n## Original Content\n\`\`\`\n${contentStr}\n\`\`\``,
                'markdown'
            );
            
            return new vscode.NotebookData([errorCell]);
        }
    }

    /**
     * Serializes notebook data to XML format for storage
     */
    async serializeNotebook(
        data: vscode.NotebookData,
        _token: vscode.CancellationToken
    ): Promise<Uint8Array> {
        const xmlContent = this.serializeToXml(data);
        return Buffer.from(xmlContent, 'utf8');
    }

    /**
     * Parses XML notebook format into VS Code notebook data
     */
    private parseXmlNotebook(content: string): vscode.NotebookData {
        const cells: vscode.NotebookCellData[] = [];
        
        // Extract metadata if present
        let metadata: Record<string, any> = {};
        const metadataRegex = /<!--\s*metadata:\s*(\{.*?\})\s*-->/s;
        const metadataMatch = metadataRegex.exec(content);
        if (metadataMatch) {
            try {
                metadata = JSON.parse(metadataMatch[1]);
            } catch {
                // Ignore invalid metadata
            }
        }

        // Parse VSCode.Cell elements
        const cellRegex = /<VSCode\.Cell(?:\s+id="([^"]*)")?(?:\s+language="([^"]*)")?\s*>(.*?)<\/VSCode\.Cell>/gs;
        let match;
        
        while ((match = cellRegex.exec(content)) !== null) {
            const [, id, language, cellContent] = match;
            
            const cellKind = language === 'markdown' ? 
                vscode.NotebookCellKind.Markup : 
                vscode.NotebookCellKind.Code;
            
            const cell = new vscode.NotebookCellData(
                cellKind,
                cellContent.trim(),
                language || 'http'
            );
            
            // Add cell metadata if ID is present
            if (id) {
                cell.metadata = { id };
            }
            
            cells.push(cell);
        }
        
        // If no cells were found, try to parse as legacy format or create default
        if (cells.length === 0) {
            cells.push(new vscode.NotebookCellData(
                vscode.NotebookCellKind.Markup,
                '# HTTP Request Notebook\n\nCreate your HTTP requests below.',
                'markdown'
            ));
        }
        
        const notebookData = new vscode.NotebookData(cells);
        notebookData.metadata = metadata;
        
        return notebookData;
    }

    /**
     * Serializes notebook data to XML format
     */
    private serializeToXml(data: vscode.NotebookData): string {
        let xml = '<!-- filepath: notebook.pfhttp -->\n';
        
        // Add metadata if present
        if (data.metadata && Object.keys(data.metadata).length > 0) {
            xml += `<!-- metadata: ${JSON.stringify(data.metadata)} -->\n`;
        }
        
        // Serialize each cell
        for (const cell of data.cells) {
            const language = cell.languageId;
            const id = cell.metadata?.id ?? this.generateCellId();
            
            xml += `<VSCode.Cell id="${id}" language="${language}">\n`;
            xml += this.escapeCellContent(cell.value);
            xml += '\n</VSCode.Cell>\n';
        }
        
        return xml;
    }

    /**
     * Escapes cell content for XML while preserving formatting
     */
    private escapeCellContent(content: string): string {
        // Don't XML encode the content - just ensure it doesn't break the XML structure
        // Remove any existing VSCode.Cell tags that might be in the content
        return content.replace(/<\/?VSCode\.Cell[^>]*>/g, '');
    }

    /**
     * Generates a unique cell ID
     */
    private generateCellId(): string {
        return Math.random().toString(36).substring(2, 10);
    }

    /**
     * Validates XML notebook format
     */
    validateNotebookFormat(content: string): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        try {
            // Check for basic XML structure
            if (!content.includes('<VSCode.Cell')) {
                errors.push('No VSCode.Cell elements found');
            }
            
            // Validate cell structure
            const cellRegex = /<VSCode\.Cell(?:\s+id="([^"]*)")?(?:\s+language="([^"]*)")?\s*>(.*?)<\/VSCode\.Cell>/gs;
            let match;
            let cellCount = 0;
              while ((match = cellRegex.exec(content)) !== null) {
                cellCount++;
                const [, , language] = match;
                
                if (language && !this.isValidLanguage(language)) {
                    errors.push(`Invalid language "${language}" in cell ${cellCount}`);
                }
            }
            
            if (cellCount === 0) {
                errors.push('No valid cells found');
            }
            
        } catch (error) {
            errors.push(`Parse error: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Checks if a language is valid for notebook cells
     */
    private isValidLanguage(language: string): boolean {
        const validLanguages = ['http', 'markdown', 'json', 'javascript', 'typescript', 'text'];
        return validLanguages.includes(language);
    }

    /**
     * Converts a regular text file to notebook format
     */
    convertTextToNotebook(content: string, defaultLanguage = 'http'): vscode.NotebookData {
        // Split content by common delimiters
        const sections = this.splitIntoSections(content);
        const cells: vscode.NotebookCellData[] = [];
        
        for (const section of sections) {
            const language = this.detectLanguage(section) ?? defaultLanguage;
            const cellKind = language === 'markdown' ? 
                vscode.NotebookCellKind.Markup : 
                vscode.NotebookCellKind.Code;
            
            cells.push(new vscode.NotebookCellData(cellKind, section.trim(), language));
        }
        
        return new vscode.NotebookData(cells);
    }

    /**
     * Converts HTTP file content to notebook format (alias for convertTextToNotebook)
     */
    convertHttpFileToNotebook(content: string): vscode.NotebookData {
        return this.convertTextToNotebook(content, 'http');
    }

    /**
     * Exports notebook data to HTTP file format
     */
    exportToHttpFile(notebookData: vscode.NotebookData): string {
        const httpSections: string[] = [];
        
        for (const cell of notebookData.cells) {
            if (cell.languageId === 'http') {
                httpSections.push(cell.value);
            } else if (cell.languageId === 'markdown') {
                // Convert markdown to comments
                const commentedMarkdown = cell.value
                    .split('\n')
                    .map(line => line.trim() ? `# ${line}` : '#')
                    .join('\n');
                httpSections.push(commentedMarkdown);
            }
            // Skip other languages like JSON for HTTP file export
        }
        
        return httpSections.join('\n\n###\n\n');
    }

    /**
     * Splits content into logical sections
     */
    private splitIntoSections(content: string): string[] {
        // Split by HTTP request boundaries or markdown headers
        const lines = content.split('\n');
        const sections: string[] = [];
        let currentSection: string[] = [];
        
        for (const line of lines) {
            // Start new section on HTTP method or markdown header
            if (this.isHttpRequestStart(line) || this.isMarkdownHeader(line)) {
                if (currentSection.length > 0) {
                    sections.push(currentSection.join('\n'));
                    currentSection = [];
                }
            }
            currentSection.push(line);
        }
        
        if (currentSection.length > 0) {
            sections.push(currentSection.join('\n'));
        }
        
        return sections.filter(section => section.trim().length > 0);
    }

    /**
     * Detects if a line starts an HTTP request
     */
    private isHttpRequestStart(line: string): boolean {
        const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
        const firstWord = line.trim().split(/\s+/)[0];
        return httpMethods.includes(firstWord?.toUpperCase() || '');
    }

    /**
     * Detects if a line is a markdown header
     */
    private isMarkdownHeader(line: string): boolean {
        return line.trim().startsWith('#');
    }

    /**
     * Detects the language of a content section
     */
    private detectLanguage(content: string): string | null {
        const trimmed = content.trim();
        
        if (this.isHttpRequestStart(trimmed)) {
            return 'http';
        }
        
        if (trimmed.startsWith('#') || trimmed.includes('##')) {
            return 'markdown';
        }
        
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                JSON.parse(trimmed);
                return 'json';
            } catch {
                // Not valid JSON
            }
        }
        
        return null;
    }
}
