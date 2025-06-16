# Environment-First Code Cleanup Plan

## Overview

The VS Code extension currently supports both environment-first and schema-first architectures with optional migration. This document outlines the plan to remove old environment-first code and force migration to schema-first architecture.

## Strategy: Force Migration on Extension Load

### 1. Auto-Migrate on Startup
- Modify extension activation to automatically migrate existing environment-first data
- Remove the optional migration prompts and make it mandatory
- Keep migration code only for the auto-migration process

### 2. Environment-First Code to Remove

#### Tree Provider Changes
- Remove `getEnvironments()` method
- Remove environment-first tree item classes:
  - `EnvironmentTreeItem`
  - `EnvironmentGroupTreeItem` 
  - `SchemaTreeItem` (old version)
- Remove dual-architecture logic in `getChildren()`

#### Command Handler Removal
- Remove old environment-first command handlers:
  - `addApiEnvironmentHandler` (old version)
  - `addEnvironmentGroupHandler` (old version)
  - `deleteApiEnvironmentHandler`
  - `deleteGroupHandler`
  - `renameEnvironmentHandler` (environment-first version)
  - `renameGroupHandler` (environment-first version)

#### Configuration Manager Cleanup
- Remove old data access methods:
  - `getApiEnvironments()`
  - `getEnvironmentGroups()`
  - `getUngroupedEnvironments()`
  - `getEnvironmentsInGroup()`
  - `saveApiEnvironment()`
  - `deleteApiEnvironment()`
  - `saveEnvironmentGroup()`
  - `deleteEnvironmentGroup()`
  - `moveEnvironmentToGroup()`

#### Command Registration Cleanup
- Remove old command registrations:
  - `pathfinder.addEnvironment`
  - `pathfinder.deleteEnvironment`
  - `pathfinder.addEnvironmentGroup`
  - `pathfinder.deleteGroup`
  - `pathfinder.renameGroup`
  - `pathfinder.renameEnvironment` (for old environments)

#### Package.json Cleanup
- Remove old command definitions
- Remove old context menu items for environment-first architecture
- Update command palette entries

### 3. Types and Interfaces to Remove
- `ApiEnvironment` (old format)
- `ApiEnvironmentGroup` (old format)
- `LoadedSchema` (old format)

### 4. Migration Code to Keep (Temporarily)
- Keep `DataMigration` class for auto-migration
- Keep backup/restore functionality
- Keep migration result types

### 5. Migration Code to Remove Later
After all users have migrated:
- Remove entire `migration/` folder
- Remove migration-related methods from ConfigurationManager
- Remove migration commands and handlers

## Implementation Steps

1. **Force Auto-Migration**: Modify extension activation to automatically migrate
2. **Remove Tree Provider Code**: Clean up old tree item classes and methods
3. **Remove Command Handlers**: Remove environment-first command handlers
4. **Remove Configuration Methods**: Clean up old data access methods
5. **Update Command Registration**: Remove old command registrations
6. **Update Package.json**: Remove old command definitions and context menus
7. **Update Types**: Remove old type definitions
8. **Test Extension**: Ensure schema-first functionality works correctly
9. **Plan Migration Code Removal**: After ensuring all users migrated

## Benefits

1. **Code Simplification**: Remove ~50% of legacy code
2. **Maintenance Reduction**: Single architecture to maintain
3. **User Experience**: Consistent schema-first experience for all users
4. **Performance**: No more dual-architecture checks

## Risks

1. **Data Loss**: Users with unmigrated data might lose environments
2. **Compatibility**: Old installations might break
3. **Testing**: Need to ensure migration works correctly

## Mitigation

1. **Backup Strategy**: Always create backups before migration
2. **Migration Testing**: Test migration with various data scenarios
3. **Rollback Plan**: Keep migration data for potential rollback
4. **User Communication**: Document the forced migration

## Files to Modify

### High Priority (Core Functionality)
- `src/extension.ts` - Force migration, remove old handlers
- `src/tree-provider.ts` - Remove environment-first tree logic
- `src/configuration.ts` - Remove old data methods
- `package.json` - Remove old commands and context menus

### Medium Priority (Types and Support)
- `src/types.ts` - Remove old type definitions
- `src/migration/data-migration.ts` - Keep for auto-migration

### Low Priority (Documentation and Cleanup)
- Update README and documentation
- Remove old test files
- Clean up sample data

## Timeline

1. **Week 1**: Implement auto-migration and test
2. **Week 2**: Remove tree provider and command handler code
3. **Week 3**: Remove configuration methods and update package.json
4. **Week 4**: Test, document, and deploy
5. **Future**: Remove migration code after all users migrated
