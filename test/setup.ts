// Jest test setup file
// This file is executed before each test file

import 'jest';

// Global test timeout (10 seconds)
jest.setTimeout(10000);

// Create a factory function for mock extension context
const createMockExtensionContext = (): any => ({
  subscriptions: [],
  secrets: {
    get: jest.fn().mockResolvedValue(undefined),
    store: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    onDidChange: jest.fn()
  },
  globalState: {
    get: jest.fn().mockReturnValue([]),
    update: jest.fn().mockResolvedValue(undefined)
  },
  workspaceState: {
    get: jest.fn().mockReturnValue(undefined),
    update: jest.fn().mockResolvedValue(undefined)
  },
  extensionPath: '/mock/extension/path',
  storagePath: '/mock/storage/path',
  globalStoragePath: '/mock/global/storage/path'
});

// Make the factory available globally for tests
(global as any).createMockExtensionContext = createMockExtensionContext;

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
  // Add context mock with secrets support
  ExtensionContext: class MockExtensionContext {
    public secrets = {
      get: jest.fn(),
      store: jest.fn(),
      delete: jest.fn(),
      onDidChange: jest.fn()
    };
    public globalState = {
      get: jest.fn(),
      update: jest.fn()
    };
    public workspaceState = {
      get: jest.fn(),
      update: jest.fn()
    };
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
  ThemeIcon: jest.fn(),  EventEmitter: jest.fn().mockImplementation(function(this: any) {
    this.event = jest.fn();
    this.fire = jest.fn();
    this.dispose = jest.fn();
  }),
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
