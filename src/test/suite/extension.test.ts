import * as vscode from 'vscode';
import * as assert from 'assert';

suite('Pathfinder - OpenAPI Explorer Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');    test('Extension should be present', () => {
        const extension = vscode.extensions.getExtension('ASHURTECHNET.pathfinder-openapi-explorer');
        assert.ok(extension);
    });    test('Extension should activate', async () => {
        const extension = vscode.extensions.getExtension('ASHURTECHNET.pathfinder-openapi-explorer');
        if (extension) {
            await extension.activate();
            assert.ok(extension.isActive);
        }
    });test('Commands should be registered', async () => {        const commands = await vscode.commands.getCommands(true);
        
        const expectedCommands = [
            'pathfinder.addEnvironment',
            'pathfinder.loadSchemaFromUrl',
            'pathfinder.loadSchemaFromFile',
            'pathfinder.listEnvironments',
            'pathfinder.showSchemaInfo',
            'pathfinder.refreshTree',
            'pathfinder.addApiSchema',
            'pathfinder.addEnvironmentGroup',
            'pathfinder.runInNotebook'
        ];
        
        expectedCommands.forEach(command => {
            assert.ok(commands.includes(command), `Command ${command} should be registered`);
        });
    });

    test('Tree view should be available', () => {
        // Tree view implementation test for Pathfinder
        assert.ok(vscode.window.createTreeView);
    });
});
