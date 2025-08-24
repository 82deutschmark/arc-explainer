# Comprehensive Dataset Import System Plan
*Date: August 24, 2025*

## Overview
Build a comprehensive system to import synthetic ARC datasets from public GitHub repositories (like `neoneye/arc-dataset-collection`), enabling seamless integration with the existing puzzle loader architecture. This system will allow researchers to easily access thousands of additional synthetic puzzles for training and evaluation.

## Current State Analysis

### Existing Architecture
- **PuzzleLoader**: Current system supports 4 local data sources (ARC1, ARC1-Eval, ARC2, ARC2-Eval) with priority-based loading
- **Database**: PostgreSQL with Drizzle ORM, two main tables (EXPLANATIONS, FEEDBACK)  
- **File Structure**: Local JSON files in `data/` directory with strict naming conventions
- **Priority System**: ARC1 datasets take precedence over ARC2 for duplicate puzzles

### Target Repository Structure
From `neoneye/arc-dataset-collection`:
- **ARC-Heavy Dataset**: Located at `/dataset/ARC-Heavy/data/b/`
- **File Pattern**: `data_suggestfunction_100k_task{0-299}.json` (300 total files)
- **Format**: Standard ARC JSON with train/test structure
- **Multiple Datasets**: Repository contains various dataset categories (a, b, c, d subdirectories)

## Implementation Plan

### Phase 1: Core Infrastructure

#### 1.1 Database Schema Extension
```sql
-- New table for tracking imported datasets
CREATE TABLE imported_datasets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  repo_url VARCHAR(500) NOT NULL,
  repo_path VARCHAR(500),
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  last_import_date TIMESTAMP,
  last_sync_date TIMESTAMP,
  commit_hash VARCHAR(40),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- New table for imported puzzle metadata
CREATE TABLE imported_puzzles (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(50) NOT NULL,
  dataset_id INTEGER REFERENCES imported_datasets(id) ON DELETE CASCADE,
  original_filename VARCHAR(255),
  import_metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(task_id, dataset_id)
);

-- Index for efficient lookups
CREATE INDEX idx_imported_puzzles_task_id ON imported_puzzles(task_id);
CREATE INDEX idx_imported_datasets_status ON imported_datasets(status);
```

#### 1.2 GitHub Integration Service
**File**: `server/services/githubIntegration.ts`
- GitHub API client for repository access (public repos, no auth required)
- Recursive directory traversal for dataset discovery
- Rate limiting and caching for API calls
- Support for raw file access via GitHub's raw content URLs

#### 1.3 Dataset Discovery Engine
**File**: `server/services/datasetDiscovery.ts`
- Pattern recognition for ARC-style JSON files
- Support for various naming conventions:
  - Standard ARC: `{taskId}.json`
  - ARC-Heavy: `data_suggestfunction_100k_task{number}.json`
  - Custom patterns via regex configuration
- Metadata extraction from repository structure and README files
- Automatic categorization by dataset type

### Phase 2: Import Processing System

#### 2.1 Dataset Parser & Validator
**File**: `server/services/datasetParser.ts`
- Generic JSON puzzle parser with format validation
- Support for standard ARC format and common variants
- Schema validation against expected train/test structure
- Error handling for malformed data with detailed reporting
- Batch processing capabilities for large datasets

#### 2.2 Import Manager
**File**: `server/services/importManager.ts`
- Background job system for large imports using worker threads
- Progress tracking with real-time updates via WebSockets
- Conflict resolution for duplicate task IDs
- Rollback capability for failed imports
- Resume functionality for interrupted imports

#### 2.3 File System Strategy
- Store imported puzzles in `data/imported/{dataset-id}/` structure
- Maintain original filenames with metadata mapping
- Lazy loading for memory efficiency
- Compression support for large datasets

### Phase 3: API Layer

#### 3.1 Backend Endpoints
```typescript
// Dataset management endpoints
POST   /api/datasets/import          // Initiate import from GitHub URL
GET    /api/datasets                 // List all imported datasets
GET    /api/datasets/:id             // Get dataset details
DELETE /api/datasets/:id             // Remove dataset and puzzles
POST   /api/datasets/:id/sync        // Sync updates from source repo
GET    /api/datasets/:id/progress    // Get import progress

// Integration with existing puzzle system
GET    /api/puzzles                  // Enhanced to include imported puzzles
GET    /api/puzzles/:id              // Works seamlessly with imported puzzles
```

#### 3.2 Enhanced PuzzleLoader
**File**: `server/services/puzzleLoader.ts` (Enhanced)
- Extend existing `DataSource` interface to include imported sources
- Add `ImportedDataSource` type alongside existing local sources
- Maintain backward compatibility with current priority system
- Add imported dataset priority configuration
- Unified puzzle metadata handling across local and imported sources

### Phase 4: User Interface

#### 4.1 Admin Dashboard
**New Component**: `client/src/pages/DatasetImport.tsx`
- Simple form to add GitHub repository URL with path specification
- Dataset preview functionality before import confirmation
- Real-time import progress monitoring with WebSocket connection
- Dataset management interface (enable/disable, sync, remove)
- Import history and status tracking

#### 4.2 Enhanced Puzzle Browser Integration  
**Enhanced Component**: `client/src/pages/PuzzleBrowser.tsx`
- Add filter for dataset source (Local, ARC-Heavy, etc.)
- Show dataset origin in puzzle metadata display
- Seamless browsing experience across local and imported puzzles
- Enhanced search capabilities across all puzzle sources

### Phase 5: Advanced Features

#### 5.1 Caching & Performance
- Local file caching system for imported puzzles
- Offline access after initial import
- Smart sync to detect repository changes using commit hashes
- Background refresh scheduling
- Efficient memory management for large datasets

#### 5.2 Version Management
- Track dataset versions using Git commit hashes
- Automatic update detection and migration
- History tracking of imports and changes
- Rollback capabilities for problematic updates

#### 5.3 Multi-Repository Support
- Support for multiple GitHub repositories simultaneously
- Repository priority system for overlapping puzzles
- Bulk import from curated repository lists
- Custom dataset categorization and tagging

## Technical Implementation Details

### Integration Points
1. **PuzzleLoader Enhancement**: Add `ImportedDataSource` alongside existing sources
2. **Database Integration**: Use existing Drizzle ORM patterns with new schemas  
3. **File System**: Maintain compatibility with current local file structure
4. **API Compatibility**: Ensure existing endpoints work seamlessly with imported data

### Error Handling Strategy
- Comprehensive validation at each import stage
- Detailed error reporting with specific failure reasons
- Partial import support (continue on individual file failures)
- Automated retry mechanisms for transient failures
- User-friendly error messages in the admin interface

### Performance Considerations
- Batch processing for large imports (100 puzzles per batch)
- Background job processing to avoid blocking main application
- Progressive loading in UI with pagination
- Efficient database indexing for fast lookups
- Memory-conscious file handling for large datasets

### Security Measures
- Validate all GitHub URLs to prevent malicious imports
- Sanitize imported puzzle data to prevent injection attacks
- Rate limiting on import operations
- File size limits to prevent resource exhaustion
- Repository whitelist capability for production environments

## Implementation Timeline

### Phase 1 (Week 1): Core Infrastructure
- Database schema design and migration
- GitHub integration service
- Basic dataset discovery engine

### Phase 2 (Week 2): Import Processing
- Dataset parser and validator
- Import manager with background jobs
- File system integration

### Phase 3 (Week 3): API Development
- Backend endpoint implementation
- PuzzleLoader enhancements
- WebSocket progress tracking

### Phase 4 (Week 4): User Interface
- Admin dashboard development
- Puzzle browser integration
- Real-time progress monitoring

### Phase 5 (Week 5): Advanced Features
- Caching and performance optimization
- Version management system
- Multi-repository support

### Phase 6 (Week 6): Testing & Polish
- Comprehensive testing across all components
- Performance optimization
- Documentation and user guides

## Expected Benefits

1. **Massive Dataset Expansion**: Access to thousands of additional synthetic puzzles
2. **Research Acceleration**: Easy access to diverse puzzle types and difficulty levels
3. **Automated Updates**: Stay current with community-generated datasets
4. **Flexible Integration**: Support for various repository formats and structures
5. **Backwards Compatibility**: Seamless operation with existing local datasets

## Risk Mitigation

- **Repository Availability**: Local caching ensures continued access even if source repos go offline
- **Format Changes**: Flexible parser system can adapt to format variations
- **Performance Impact**: Background processing prevents UI blocking during imports
- **Data Quality**: Validation system catches malformed puzzles before import
- **Version Control**: Git-based tracking enables easy rollbacks if needed

This comprehensive system will transform the ARC explainer into a powerful research tool capable of working with the entire ecosystem of community-generated ARC datasets.