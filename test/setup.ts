// Jest test setup file
// This file is executed before each test file

import 'jest';

// Global test timeout (10 seconds)
jest.setTimeout(10000);

// Mock VS Code API globally
const mockVscode = {
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn(),
      update: jest.fn(),
      has: jest.fn(),
      inspect: jest.fn()
    })),
    workspaceFolders: [],
    onDidChangeConfiguration: jest.fn(),
    fs: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      stat: jest.fn()
    }
  },
  window: {
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    showInputBox: jest.fn(),
    showQuickPick: jest.fn(),
    createWebviewPanel: jest.fn(),
    createTreeView: jest.fn(),
    showTextDocument: jest.fn()
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn()
  },
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path, path })),
    parse: jest.fn()
  },
  ViewColumn: {
    One: 1,
    Two: 2,
    Three: 3
  },
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2
  },  TreeItem: class MockTreeItem {
    public label: string;
    public collapsibleState?: number;

    constructor(label: string, collapsibleState?: number) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  },
  ThemeIcon: jest.fn(),
  EventEmitter: jest.fn(() => ({
    event: jest.fn(),
    fire: jest.fn(),
    dispose: jest.fn()
  })),
  Disposable: {
    from: jest.fn()
  },
  StatusBarAlignment: {
    Left: 1,
    Right: 2
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3
  }
};

// Mock the vscode module
jest.mock('vscode', () => mockVscode, { virtual: true });

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      // Add custom matchers here if needed
    }
  }
}

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

export { mockVscode };
