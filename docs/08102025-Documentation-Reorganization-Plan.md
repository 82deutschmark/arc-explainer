# Documentation Reorganization Plan
**Date:** 2025-10-08  
**Goal:** Make README user-focused, move technical details to CLAUDE.md, update to v3.7.7

## Analysis

### Current State
- **README.md:** v3.5.1 (Oct 5), 398 lines, 174 lines of SQL schemas, generic boilerplate
- **CLAUDE.md:** v3.6.x info, missing ELO tables, missing full API reference, missing v3.7.x updates
- **CHANGELOG.md:** ✅ Updated to v3.7.7

### Information to Preserve

#### From README.md → Move to CLAUDE.md:
1. **Full Database Schemas** (Lines 108-197)
   - Complete explanations table with all fields
   - Feedback table
   - ELO rating system tables (elo_ratings, elo_comparisons)
   - Index definitions

2. **API Reference Section** (Lines 199-282)
   - Core endpoints with full request/response examples
   - Batch analysis endpoints
   - Prompt preview endpoints
   - Data retrieval endpoints
   - Debate & rebuttal endpoints

3. **Deployment Details** (Lines 284-300)
   - Railway deployment steps
   - Docker deployment
   - Environment variables

#### Keep in README.md (User-Focused):
1. Version and last updated date → **UPDATE to v3.7.7, Oct 8, 2025**
2. Overview and value proposition
3. Feature highlights (EXPAND with v3.7.x features)
4. Quick links to documentation
5. Brief architecture overview (high-level only)
6. Research applications section
7. ARC-AGI task format explanation (it's unique to this project)

#### Remove from README.md (Boilerplate):
1. Installation steps ("obvious stuff")
2. Prerequisites section ("DUH?!")
3. Environment configuration details
4. Deployment step-by-step instructions
5. Full SQL schemas
6. Detailed API endpoint documentation

### Missing from Both Files (Add to README):
From CHANGELOG v3.7.0-v3.7.7:
1. **Batch Analysis Web UI** (`/models` page)
2. **Conversation Chaining** (multi-turn with reasoning persistence)
3. **PuzzleDiscussion Feature** (self-refinement)
4. **Live Activity Logs** (terminal-style real-time updates)
5. **Parallel Processing** (10-20x faster batch analysis)
6. **Correctness Filtering** (show correct/incorrect only)
7. **ModelBrowser Click-to-Analyze**

## Implementation Plan

### Step 1: Update CLAUDE.md Technical Section
Add after line 442 (end of current content):

```markdown
## Complete Database Schema Reference

### Explanations Table (Full Schema)
[Move full SQL from README lines 111-159]

### Feedback Table
[Move from README lines 161-170]

### ELO Rating System Tables
[Move from README lines 172-197]

### Ingestion Runs Table
[Add from v3.4.1 changelog]

## Complete API Endpoint Reference

### Puzzle Analysis Endpoints
[Move from README lines 199-220]

### Batch Analysis Endpoints  
[Move from README lines 222-234]

### Prompt Preview Endpoints
[Move from README lines 236-247]

### Data Retrieval Endpoints
[Move from README lines 249-267]

### Debate & Conversation Endpoints
[Move from README lines 269-282]

### Discussion Endpoints (v3.6.4+)
- GET /api/discussion/eligible - Server-filtered eligible explanations
- [Add details from v3.7.7 changelog]

## Deployment Guide

### Railway Deployment
[Move from README lines 284-294]

### Docker Deployment  
[Move from README lines 296-300]

### Environment Variables
[List all required env vars with descriptions]
```

### Step 2: Rewrite README.md
**New Structure (Target: ~150 lines):**

1. **Header** (10 lines)
   - Title, version 3.7.7, date Oct 8, 2025
   - One-sentence description
   - Link to demo/repo

2. **What's New in v3.7.7** (20 lines)
   - Conversation Chaining operational
   - PuzzleDiscussion feature complete
   - Batch Web UI with parallel processing
   - Live activity logs
   - Correctness filtering

3. **Key Features** (50 lines)
   - Conversation Chaining & Progressive Reasoning
   - Batch Analysis Web UI (10-20x faster)
   - PuzzleDiscussion Self-Refinement
   - Model Debate System
   - ELO Rating System
   - Multi-Provider AI Integration
   - Reasoning Capture
   - Analytics & Cost Tracking
   - Live Activity Monitoring

4. **Quick Start** (10 lines)
   - `npm install && npm run test`
   - Set API keys in .env
   - Open localhost:5173
   - Link to CLAUDE.md for technical setup

5. **Architecture Overview** (20 lines)
   - High-level: React + Express + PostgreSQL
   - Multi-provider AI services
   - Real-time WebSocket updates
   - Link to CLAUDE.md for details

6. **For Researchers** (20 lines)
   - Pattern recognition studies
   - Model comparison workflows
   - Cost analysis
   - HuggingFace dataset ingestion

7. **Documentation Links** (10 lines)
   - CLAUDE.md - Technical architecture & setup
   - CHANGELOG.md - Version history
   - docs/EXTERNAL_API.md - API reference
   - docs/ - Additional guides

8. **ARC-AGI Task Format** (20 lines)
   - Keep the unique task format explanation
   - This is domain-specific, not boilerplate

### Step 3: Verification Checklist
- [ ] All SQL schemas in CLAUDE.md
- [ ] All API endpoints documented in CLAUDE.md
- [ ] All deployment instructions in CLAUDE.md
- [ ] README focuses on features and capabilities
- [ ] README shows v3.7.7 updates
- [ ] No information lost
- [ ] Links between files work correctly
- [ ] Boilerplate removed from README

## Key Decisions

1. **Database schemas → CLAUDE.md** - Too technical for front-facing doc
2. **API details → CLAUDE.md** - Developers need this, users don't
3. **Installation steps → Remove** - Experienced devs know this
4. **Feature highlights → README** - Users care about capabilities
5. **ARC task format → Keep in README** - Unique to this project, explains what the puzzles are

## Success Criteria

✅ README is <200 lines and user-focused  
✅ CLAUDE.md has all technical details  
✅ v3.7.7 features prominently featured  
✅ No duplicate information  
✅ Clear navigation between docs
