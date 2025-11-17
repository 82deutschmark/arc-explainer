# ARC Human Contributor Trading Cards Feature - Implementation Plan

**Author:** Claude Code using Sonnet 4.5
**Date:** 2025-11-16
**Purpose:** Comprehensive plan for adding trading cards featuring notable human contributors to the ARC-AGI challenge

---

## Executive Summary

Create a new feature that displays notable ARC-AGI competitors and researchers as trading cards, similar to the existing puzzle trading cards. Each card will showcase a person's achievements, approach, and contributions to advancing ARC-AGI solving techniques.

## Research Summary

Found 33 notable contributors including:
- **Competition Winners**: Jeremy Berman (79.6% SOTA), Daniel Franzen (53.5%), JFPuget/Ivan Sorokin, MindsAI team
- **Paper Award Winners**: Wen-Ding Li, Kevin Ellis, Ekin Akyürek, Jacob Andreas, Clément Bonnet
- **Pioneers**: François Chollet (creator), Mike Knoop (founder), icecuber (first winner 2020)
- **Key Researchers**: Jack Cole, Mohamed Osman, Michael Hodel, Ryan Greenblatt

## Database Schema

### New Table: `arc_contributors`

```sql
CREATE TABLE arc_contributors (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  handle VARCHAR(100),
  affiliation TEXT,
  achievement TEXT NOT NULL,
  description TEXT NOT NULL,
  year_start INTEGER,
  year_end INTEGER,
  score VARCHAR(50),
  approach TEXT,
  unique_technique TEXT,
  links JSONB DEFAULT '{}',
  team_name VARCHAR(100),
  category VARCHAR(50) NOT NULL,
  image_url VARCHAR(500),
  rank INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_arc_contributors_category ON arc_contributors(category);
CREATE INDEX idx_arc_contributors_year ON arc_contributors(year_start DESC);
```

### Categories
- `competition_winner` - Competition winners (2020-2024)
- `paper_award` - Paper award winners
- `researcher` - Notable researchers
- `founder` - Creators and organizers
- `pioneer` - Early contributors

## Backend API

### New Endpoint: `GET /api/arc-contributors`

**Response:**
```typescript
{
  contributors: ArcContributor[];
  total: number;
}

interface ArcContributor {
  id: number;
  fullName: string;
  handle: string | null;
  affiliation: string | null;
  achievement: string;
  description: string;
  yearStart: number | null;
  yearEnd: number | null;
  score: string | null;
  approach: string | null;
  uniqueTechnique: string | null;
  links: {
    twitter?: string;
    github?: string;
    website?: string;
    kaggle?: string;
    papers?: string[];
  };
  teamName: string | null;
  category: string;
  imageUrl: string | null;
  rank: number | null;
}
```

## Frontend Components

### 1. `HumanTradingCard.tsx`
Similar to `PuzzleTradingCard.tsx` but for humans:
- Name and handle prominently displayed
- Achievement badge (score, award, etc.)
- Affiliation and team
- Category badge
- Expandable details showing approach, techniques, links

### 2. `HumanTradingCards.tsx`
Gallery page similar to `PuzzleTradingCards.tsx`:
- Filter by category, year, team
- Sort by score, year, name
- Search by name or handle
- Hero section with description

### 3. Helper utilities: `humanCardHelpers.ts`
- Format score badges
- Get category colors
- Calculate achievement level

## Styling

### Card Design
- Similar 1980s trading card aesthetic
- Category-based color themes:
  - **Competition Winners**: Gold/yellow gradient
  - **Paper Awards**: Blue/purple gradient
  - **Researchers**: Green/teal gradient
  - **Founders**: Red/orange gradient
  - **Pioneers**: Silver/gray gradient

### Card Layout
```
┌─────────────────────────────────────┐
│  ╔═══════════════════════════════╗  │
│  ║   [PROFILE IMAGE or ICON]     ║  │
│  ║                               ║  │
│  ║   JEREMY BERMAN               ║  │ <- Name (large)
│  ║   @jerber888                  ║  │ <- Handle
│  ║                               ║  │
│  ║   ┌─────────────┐             ║  │
│  ║   │ 79.6% SOTA  │             ║  │ <- Achievement badge
│  ║   └─────────────┘             ║  │
│  ║                               ║  │
│  ║   Competition Winner 2024-25  ║  │ <- Category
│  ║   Independent Researcher      ║  │ <- Affiliation
│  ║                               ║  │
│  ╚═══════════════════════════════╝  │
└─────────────────────────────────────┘
```

## Routing

- Add route `/human-cards` or `/contributors`
- Add navigation link in main menu

## Files to Create

```
server/repositories/database/DatabaseSchema.ts (MODIFY - add table)
server/repositories/ContributorRepository.ts (NEW)
server/routes/contributorRoutes.ts (NEW)
client/src/components/human/HumanTradingCard.tsx (NEW)
client/src/pages/HumanTradingCards.tsx (NEW)
client/src/utils/humanCardHelpers.ts (NEW)
client/src/hooks/useArcContributors.ts (NEW)
shared/types/contributor.ts (NEW)
docs/plans/2025-11-16-human-trading-cards-feature-plan.md (THIS FILE)
```

## Implementation Steps

1. ✅ Research notable ARC contributors
2. ⏳ Update database schema with `arc_contributors` table
3. ⏳ Create backend repository and routes
4. ⏳ Create TypeScript types
5. ⏳ Implement frontend hook
6. ⏳ Create HumanTradingCard component
7. ⏳ Create HumanTradingCards page
8. ⏳ Add routing and navigation
9. ⏳ Populate database with researched data

## SRP/DRY Check

**Pass** - Reuses existing patterns:
- Similar to puzzle trading cards but for humans
- Reuses Badge, card styling patterns
- Follows same repository/route/hook architecture
- No code duplication
