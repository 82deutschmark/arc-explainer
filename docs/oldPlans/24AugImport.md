# Simple Dataset Import System Plan (Starting with ARC-Heavy)
*Date: August 24, 2025*

## Overview
Start simple by importing the specific ARC-Heavy dataset from `neoneye/arc-dataset-collection`, with architecture that can expand to other datasets later. Focus on getting the 300 ARC-Heavy puzzles working first, then iterate.

## Current State Analysis

### Existing Architecture
- **PuzzleLoader**: Current system supports 4 local data sources (ARC1, ARC1-Eval, ARC2, ARC2-Eval) with priority-based loading
- **Database**: PostgreSQL with Drizzle ORM, two main tables (EXPLANATIONS, FEEDBACK)  
- **File Structure**: Local JSON files in `data/` directory with strict naming conventions
- **Priority System**: ARC1 datasets take precedence over ARC2 for duplicate puzzles

### Target: ARC-Heavy Dataset
From `neoneye/arc-dataset-collection`:
- **Location**: `/dataset/ARC-Heavy/data/b/`
- **File Pattern**: `data_suggestfunction_100k_task{0-299}.json` (300 total files)
- **Format**: Standard ARC JSON with train/test structure
- **Goal**: Import these 300 puzzles as a new data source

## Phase 1: Minimal Viable Import (1-2 hours)

### 1.1 Simple Import Script
**File**: `scripts/importArcHeavy.js`
- Fetch the 300 JSON files directly from GitHub raw URLs
- Parse and validate each puzzle file
- Save to `data/arc-heavy/` directory with clean naming (`task_0.json` to `task_299.json`)
- Simple error handling and progress logging

### 1.2 Extend Existing PuzzleLoader
**File**: `server/services/puzzleLoader.ts` (minimal changes)
- Add `arc-heavy` as a new data source (like existing evaluation, training dirs)
- Give it priority 5 (lowest) so it doesn't conflict with existing puzzles
- Add `'ARC-Heavy'` as a new source type in the existing enum
- No database schema changes needed initially

### 1.3 Test Integration
- Run the import script once manually
- Verify puzzles appear in existing puzzle browser
- Check that puzzle metadata shows `source: 'ARC-Heavy'`

## Phase 2: Make It Reusable (2-3 hours)

### 2.1 Configurable Import Script
- Accept GitHub repo URL and path as parameters
- Support different naming patterns via simple config
- Add dry-run mode for testing

### 2.2 Basic Database Tracking (optional)
- Add `import_source` field to existing puzzle metadata
- Track which puzzles came from which import (for future cleanup)
- Use existing database structure - no new tables yet

### 2.3 Simple UI Integration
- Add dataset filter to existing puzzle browser
- Show import source in puzzle details
- Maybe add a simple "Import Dataset" button (just runs the script)

## Phase 3: Future Expansion (only if actually needed)

### 3.1 Multiple Datasets
- Support importing from different repo paths  
- Handle naming conflicts between datasets
- Priority system for overlapping puzzles

### 3.2 Manual Re-import
- Re-run import script when datasets change
- Simple cleanup of old puzzles before re-import

That's it. No automatic updates, no complex UI. Keep it simple.

## Implementation Strategy

**Start Small**: Get ARC-Heavy working with minimal changes to existing code
**Iterate**: Only add complexity when actually needed
**Reuse**: Leverage existing PuzzleLoader patterns instead of rebuilding
**Test Early**: Verify each phase works before moving to the next

## Expected Timeline

- **Phase 1**: 1-2 hours to get ARC-Heavy puzzles imported and working
- **Phase 2**: 2-3 hours to make it reusable for other similar datasets  
- **Phase 3**: Add complexity only when actually needed for more datasets

This approach gets you 300 new puzzles quickly while building a foundation that can grow with your needs.