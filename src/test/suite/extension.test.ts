import * as vscode from 'vscode';
import * as assert from 'assert';

suite('API Helper Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        const extension = vscode.extensions.getExtension('your-publisher.api-helper-extension');
        assert.ok(extension);
    });

    test('Extension should activate', async () => {
        const extension = vscode.extensions.getExtension('your-publisher.api-helper-extension');
        if (extension) {
            await extension.activate();
            assert.ok(extension.isActive);
        }
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        
        const expectedCommands = [
            'apiHelper.addEnvironment',
            'apiHelper.loadSchemaFromUrl',
            'apiHelper.loadSchemaFromFile',
            'apiHelper.listEnvironments',
            'apiHelper.listSchemas',
            'apiHelper.removeEnvironment',
            'apiHelper.removeSchema',
            'apiHelper.clearAllData'
        ];
        
        expectedCommands.forEach(command => {
            assert.ok(commands.includes(command), `Command ${command} should be registered`);
        });
    });

    test('Tree view should be available', () => {
        // This would need to be expanded based on your tree view implementation
        assert.ok(vscode.window.createTreeView);
    });
});
