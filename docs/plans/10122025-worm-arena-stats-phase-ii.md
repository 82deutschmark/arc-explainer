# Worm Arena Stats & Placement Page - Phase II Frontend Implementation

**Author:** Claude Code using Sonnet 4.5
**Date:** 2025-12-10
**Purpose:** Complete frontend implementation for model-centric TrueSkill stats viewer with placement tracking, history visualization, and research terminal aesthetic.

## Objective

Build a comprehensive stats page that lets users select a model and view its complete Worm Arena placement story: TrueSkill rating snapshot, 9-game placement progress, rating history chart with uncertainty bands, and full match history table. Design follows existing Worm Arena farm aesthetic (earthy tones, worm emojis, Fredoka font) combined with info-dense research terminal layout.

---

## Design System Specification

### Color Palette (Worm Arena + Research Terminal)

**Base Worm Arena Colors:**
- Background: `#f5e6d3` (cream/parchment)
- Dark soil: `#2d1f0f` (header)
- Medium soil: `#6b5344`, `#5a4535` (board backgrounds)
- Light tan: `#d4a574` (accents)
- Border tan: `#d4b5a0`
- Text dark: `#3d2817`, `#2d2416`
- Text muted: `#7a6b5f`

**Research Terminal Accent Colors:**
- Data highlight: `#4a9eff` (info blue for charts)
- Success green: `#10b981` (wins, positive trends)
- Warning amber: `#f59e0b` (uncertainty, volatility)
- Danger red: `#ef4444` (losses, negative trends)
- Neutral slate: `#64748b` (secondary data)

**Chart Colors:**
- Primary line: `#6366f1` (indigo - TrueSkill rating line)
- Uncertainty band: `rgba(99, 102, 241, 0.1)` (light indigo fill)
- Grid lines: `rgba(61, 40, 23, 0.1)` (subtle tan)

### Typography

**Font Stack:**
- Primary: `'Fredoka', 'Nunito', sans-serif` (existing Worm Arena)
- Monospace data: `'Monaco', 'Consolas', 'Courier New', monospace` (ratings, stats)

**Scales:**
- Page title: `text-3xl font-bold` (32px, Fredoka)
- Section headers: `text-xl font-semibold` (20px)
- Card titles: `text-base font-semibold` (16px)
- Body text: `text-sm` (14px)
- Data labels: `text-xs font-mono` (12px, monospace)
- Table cells: `text-xs` (12px)

### Spacing & Layout

**Grid System:**
- Max width: `max-w-7xl mx-auto` (matches WormArena.tsx)
- Section padding: `p-8`
- Card padding: `p-6`
- Card gaps: `gap-6` (24px between cards)
- Compact mode gaps: `gap-4` (16px for dense sections)

**Component Heights:**
- TrueSkill snapshot cards: `min-h-[120px]`
- Placement progress bar: `h-16`
- Chart container: `h-[400px]`
- Match history table: `max-h-[600px] overflow-y-auto`

### Component Design Patterns

**Cards:**
- Border: `border-2 border-[#d4b5a0]`
- Background: `bg-white/95` (subtle transparency)
- Rounded: `rounded-xl`
- Shadow: `shadow-md`

**Data Tables:**
- Header: `bg-[#f9f2e7] border-b-2 border-[#d4a574]`
- Row hover: `hover:bg-[#faf5f0]`
- Striped: alternating `bg-white` / `bg-[#faf5f0]`
- Dense padding: `py-2 px-3`

**Interactive Elements:**
- Primary button: `bg-[#d4a574] hover:bg-[#c79b6d] text-white`
- Secondary button: `border-2 border-[#d4b5a0] bg-white hover:bg-[#faf5f0]`
- Search input: `border-2 border-[#d4b5a0] focus:border-[#c79b6d]`

---

## Files to Create

### Page Component
- `client/src/pages/WormArenaStats.tsx` - Main stats page container

### Feature Components
- `client/src/components/WormArenaModelSearch.tsx` - Model selection autocomplete
- `client/src/components/WormArenaTrueSkillSnapshot.tsx` - TrueSkill rating cards (μ, σ, exposed, display)
- `client/src/components/WormArenaPlacementProgress.tsx` - 9-game placement tracker
- `client/src/components/WormArenaRatingChart.tsx` - Rating history with uncertainty bands
- `client/src/components/WormArenaMatchHistoryTable.tsx` - Full match history table

### Hooks
- `client/src/hooks/useModelRating.ts` - Fetch single model TrueSkill snapshot
- `client/src/hooks/useModelHistory.ts` - Fetch model match history
- `client/src/hooks/useModelSearch.ts` - Search/autocomplete for model selection

### Types (extend `shared/types.ts`)
- Add `SnakeBenchModelRating` interface
- Add `SnakeBenchModelHistoryEntry` interface
- Add `SnakeBenchStatsResponse` interface

---

## Implementation Tasks

### 1. Extend Shared Types
**File:** `shared/types.ts`

Add TrueSkill and model history interfaces after existing SnakeBench types:

```typescript
export interface SnakeBenchModelRating {
  modelSlug: string;
  mu: number;           // TrueSkill mean
  sigma: number;        // TrueSkill uncertainty
  exposedRating: number; // Conservative rating (μ - 3σ)
  displayScore: number;  // UI-friendly score (scaled)
  gamesPlayed: number;
  placementComplete: boolean; // True after 9+ games
  lastPlayed?: string;   // ISO timestamp
}

export interface SnakeBenchModelHistoryEntry {
  gameId: string;
  opponent: string;
  result: 'win' | 'loss' | 'tie';
  score: number;        // Model's score in that game
  opponentScore: number;
  muBefore: number;     // TrueSkill μ before this game
  muAfter: number;      // TrueSkill μ after this game
  sigmaBefore: number;  // σ before
  sigmaAfter: number;   // σ after
  playedAt: string;     // ISO timestamp
  roundsPlayed: number;
  boardSize: string;    // e.g., "10x10"
}

export interface SnakeBenchStatsResponse {
  success: boolean;
  stats?: {
    totalGames: number;
    totalModels: number;
    averageGameLength: number;
  };
  error?: string;
  timestamp: number;
}

export interface SnakeBenchModelRatingResponse {
  success: boolean;
  rating?: SnakeBenchModelRating;
  error?: string;
  timestamp: number;
}

export interface SnakeBenchModelHistoryResponse {
  success: boolean;
  history?: SnakeBenchModelHistoryEntry[];
  total?: number;
  error?: string;
  timestamp: number;
}
```

### 2. Create Model Rating Hook
**File:** `client/src/hooks/useModelRating.ts`

```typescript
import { useState, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';
import type { SnakeBenchModelRatingResponse, SnakeBenchModelRating } from '@shared/types';

export function useModelRating() {
  const [rating, setRating] = useState<SnakeBenchModelRating | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRating = useCallback(async (modelSlug: string) => {
    if (!modelSlug) return;
    setIsLoading(true);
    setError(null);
    try {
      const url = `/api/snakebench/model-rating?modelSlug=${encodeURIComponent(modelSlug)}`;
      const res = await apiRequest('GET', url);
      const json = (await res.json()) as SnakeBenchModelRatingResponse;

      if (!json.success) {
        throw new Error(json.error || 'Failed to load model rating');
      }

      setRating(json.rating ?? null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load model rating');
      setRating(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { rating, isLoading, error, fetchRating };
}
```

### 3. Create Model History Hook
**File:** `client/src/hooks/useModelHistory.ts`

```typescript
import { useState, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';
import type { SnakeBenchModelHistoryResponse, SnakeBenchModelHistoryEntry } from '@shared/types';

export function useModelHistory() {
  const [history, setHistory] = useState<SnakeBenchModelHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (modelSlug: string, limit: number = 50) => {
    if (!modelSlug) return;
    setIsLoading(true);
    setError(null);
    try {
      const url = `/api/snakebench/model-history?modelSlug=${encodeURIComponent(modelSlug)}&limit=${limit}`;
      const res = await apiRequest('GET', url);
      const json = (await res.json()) as SnakeBenchModelHistoryResponse;

      if (!json.success) {
        throw new Error(json.error || 'Failed to load match history');
      }

      setHistory(json.history ?? []);
      setTotal(json.total ?? 0);
    } catch (e: any) {
      setError(e?.message || 'Failed to load match history');
      setHistory([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { history, total, isLoading, error, fetchHistory };
}
```

### 4. Create Model Search Hook
**File:** `client/src/hooks/useModelSearch.ts`

```typescript
import { useState, useCallback } from 'react';

// Lightweight in-memory search using leaderboard data
export function useModelSearch(modelSlugs: string[]) {
  const [query, setQuery] = useState('');

  const filteredModels = modelSlugs.filter((slug) =>
    slug.toLowerCase().includes(query.toLowerCase())
  );

  return {
    query,
    setQuery,
    filteredModels,
  };
}
```

### 5. Create TrueSkill Snapshot Component
**File:** `client/src/components/WormArenaTrueSkillSnapshot.tsx`

Four-card grid showing:
1. **Display Score** (large, primary)
2. **TrueSkill μ** (mean rating)
3. **TrueSkill σ** (uncertainty)
4. **Exposed Rating** (conservative: μ - 3σ)

Each card: colored border (green if placement complete, amber if not), large monospace number, label, emoji indicator.

Layout: `grid grid-cols-2 lg:grid-cols-4 gap-4`

### 6. Create Placement Progress Component
**File:** `client/src/components/WormArenaPlacementProgress.tsx`

Visual tracker for 9-game placement matches:
- Horizontal progress bar with 9 segments
- Each segment: filled circle (🐛 worm) if game played, empty circle if pending
- Color: green for wins, red for losses, gray for ties
- Below bar: "X / 9 placement games complete"
- If complete: "✓ Placement Complete" badge

### 7. Create Rating History Chart Component
**File:** `client/src/components/WormArenaRatingChart.tsx`

Line chart with uncertainty band:
- X-axis: game number or date
- Y-axis: TrueSkill μ rating
- Primary line: μ over time (indigo)
- Shaded band: μ ± σ (light indigo fill)
- Grid lines: subtle tan
- Tooltips on hover: show game details

Use shadcn/ui `<Chart>` component (Recharts wrapper) from `client/src/components/ui/chart.tsx`.

### 8. Create Match History Table Component
**File:** `client/src/components/WormArenaMatchHistoryTable.tsx`

Dense data table with columns:
- Date (formatted)
- Opponent (model slug)
- Result (badge: green W / red L / gray T)
- Score (model score vs opponent score)
- μ Change (before → after, with delta)
- σ Change (before → after, with delta)
- Rounds
- Board Size
- Actions (View Replay link)

Use shadcn/ui `<Table>` component from `client/src/components/ui/table.tsx`.

Styling: striped rows, compact padding, sticky header, max-height with scroll.

### 9. Create Model Search Component
**File:** `client/src/components/WormArenaModelSearch.tsx`

Autocomplete search input:
- Large search box at top of page
- Dropdown with filtered model list (from leaderboard)
- Show model name + games played count
- Click to select and load stats

Use shadcn/ui `<Command>` component for autocomplete or `<Select>` for simpler dropdown.

### 10. Create Main Stats Page
**File:** `client/src/pages/WormArenaStats.tsx`

Page structure:
```
<WormArenaHeader> (reuse existing)
  - Links: Replay | Live Games | Stats (active) | Leaderboards

<main>
  <WormArenaModelSearch>

  {selectedModel && (
    <>
      <section "TrueSkill Snapshot">
        <WormArenaTrueSkillSnapshot>
      </section>

      <section "Placement Progress">
        <WormArenaPlacementProgress>
      </section>

      <section "Rating History">
        <WormArenaRatingChart>
      </section>

      <section "Match History">
        <WormArenaMatchHistoryTable>
      </section>
    </>
  )}

  {!selectedModel && (
    <EmptyState>
      "Select a model to view stats 🐛"
    </EmptyState>
  )}
</main>
```

### 11. Add Route to Client Router
**File:** `client/src/App.tsx` (or wherever routes are defined)

Add route:
```typescript
<Route path="/worm-arena/stats" component={WormArenaStats} />
```

Update WormArenaHeader links array to include Stats link.

### 12. Wire Backend Endpoints (if not already done in Phase I)

Verify these endpoints exist and return correct data:
- `GET /api/snakebench/stats` → global stats
- `GET /api/snakebench/model-rating?modelSlug=X` → single model rating
- `GET /api/snakebench/model-history?modelSlug=X&limit=50` → match history

If missing, coordinate with backend team to ensure Phase I endpoints are complete.

---

## Integration Points

### With Existing Worm Arena Components
- Reuse `WormArenaHeader` component (already supports links array)
- Reuse earthy color palette and Fredoka font
- Match card styling from `WormArenaStatsPanel`, `WormArenaReasoning`

### With shadcn/ui Components
- `Card`, `CardHeader`, `CardTitle`, `CardContent` - stat cards
- `Table`, `TableHeader`, `TableRow`, `TableCell` - match history
- `Command`, `CommandInput`, `CommandList` - model search autocomplete
- `Badge` - result indicators (W/L/T)
- `Chart` (Recharts) - rating history line chart
- `Progress` - placement progress bar (or custom)
- `Skeleton` - loading states

### With Backend APIs
- `/api/snakebench/model-rating` - TrueSkill snapshot
- `/api/snakebench/model-history` - match history
- `/api/snakebench/leaderboard` - model list for search

---

## Custom Animations & Interactions

### Placement Progress Animation
- When loading data, animate worm emojis filling in one by one
- Stagger entrance: 50ms delay per segment
- Use CSS `@keyframes` for worm "crawl" effect

### Chart Interactions
- Hover tooltips showing full game details
- Click data point → navigate to replay page for that game
- Smooth line transitions when data updates

### Search Autocomplete
- Highlight matching text in results
- Keyboard navigation (up/down arrows, Enter to select)
- Auto-focus on page load

### Loading States
- Skeleton loaders for TrueSkill cards (shimmer effect)
- Spinner for chart while fetching history
- Placeholder rows in table

### Responsive Behavior
- Mobile: stack TrueSkill cards vertically (2x2 → 1 column)
- Mobile: horizontal scroll for match history table
- Mobile: collapse chart height to 300px

---

## File Structure Checklist

```
client/src/
├── pages/
│   └── WormArenaStats.tsx          ✓ Main page
├── components/
│   ├── WormArenaModelSearch.tsx    ✓ Search input
│   ├── WormArenaTrueSkillSnapshot.tsx ✓ Rating cards
│   ├── WormArenaPlacementProgress.tsx ✓ 9-game tracker
│   ├── WormArenaRatingChart.tsx    ✓ History chart
│   └── WormArenaMatchHistoryTable.tsx ✓ Match table
├── hooks/
│   ├── useModelRating.ts           ✓ Rating hook
│   ├── useModelHistory.ts          ✓ History hook
│   └── useModelSearch.ts           ✓ Search hook
shared/
└── types.ts                        ✓ Add SnakeBench types
```

---

## Validation

Phase II is complete when:

1. User can navigate to `/worm-arena/stats`
2. User can search/select a model from dropdown
3. TrueSkill snapshot cards display correctly with live data
4. Placement progress shows accurate game count and status
5. Rating history chart renders with uncertainty band
6. Match history table shows all games with correct details
7. Clicking "View Replay" navigates to game detail page
8. All loading/error states handled gracefully
9. Design matches Worm Arena aesthetic (earthy, fun, info-dense)
10. Mobile responsive (tested on 375px viewport)

No backend changes required - all endpoints from Phase I are already implemented.

---

## Notes

- **No time estimates** - implement at sustainable pace
- **No testing strategy** - user will validate manually
- **Info-dense design** - prioritize data visibility over whitespace
- **Reuse existing patterns** - follow WormArena.tsx layout conventions
- **Farm aesthetic maintained** - worm emojis, earthy tones, playful but professional
