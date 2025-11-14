# ARC Puzzle Trading Cards Feature - Implementation Plan

**Author:** Claude Code using Sonnet 4.5  
**Date:** 2025-11-14  
**Purpose:** Comprehensive plan for a new page that presents named ARC puzzles as 1980s Topps-style baseball trading cards

---

## Executive Summary

Create a new page that displays named ARC puzzles as vintage 1980s Topps baseball trading cards. Each card shows the puzzle grid prominently with metadata styled like player stats, including a "win/loss record" representing how often LLMs failed vs. succeeded on that puzzle. Cards are displayed in a shop-like gallery and expand on click to show detailed performance statistics.

---

## 1. Architecture Overview

### 1.1 Component Hierarchy

```
PuzzleTradingCards (New Page)
├── Header
│   ├── CollapsibleMission (Reused)
│   └── EmojiMosaicAccent (Reused)
├── Filters Section
│   └── Dataset Filter, Sort Options
├── Card Gallery
│   └── PuzzleTradingCard[] (New Component)
│       ├── Card Front (Always Visible)
│       │   ├── TinyGrid (Reused)
│       │   ├── Puzzle Name/ID
│       │   ├── Dataset Badge (Team)
│       │   └── Win/Loss Record
│       └── Card Back (Expandable)
│           ├── Detailed Stats
│           ├── Model Performance Breakdown
│           └── Historical Attempts
└── Reference Section (Optional)
```

### 1.2 Data Flow

```
1. User visits /puzzle-cards
2. PuzzleTradingCards calls usePuzzleStats()
3. Hook fetches /api/puzzles/stats?includeRichMetrics=true
4. Filter to puzzles with names (hasPuzzleName(puzzle.id))
5. Calculate win/loss per puzzle from performanceData
6. Render cards in gallery layout
7. Click card → expand to show detailed stats
```

### 1.3 SRP/DRY Analysis

**Single Responsibility Adherence:**
- `PuzzleTradingCards.tsx`: Page orchestration, filtering, layout
- `PuzzleTradingCard.tsx`: Individual card presentation and expansion
- `usePuzzleStats()`: Data fetching (reused)
- `TinyGrid`: Grid rendering (reused)
- `puzzleNames.ts`: Name lookup (reused)

**DRY Compliance:**
- Reuses existing `TinyGrid` for grid display
- Reuses `usePuzzleStats()` hook for data
- Reuses `getPuzzleName()` and `hasPuzzleName()` utilities
- Reuses `CollapsibleMission` and `EmojiMosaicAccent` components
- Reuses `CollapsibleCard` pattern for expansion

---

## 2. Data Source & API Endpoints

### 2.1 Existing Endpoints (No New Endpoints Needed!)

**Primary Data Source:**
```typescript
GET /api/puzzles/stats?limit=4000&includeRichMetrics=true
```

**Response Structure:**
```typescript
interface PuzzleStatsApiResponse {
  puzzles: PuzzleStatsRecord[];
  total: number;
}

interface PuzzleStatsRecord {
  id: string;
  source?: string; // Dataset (ARC1, ARC2, etc.)
  hasExplanation?: boolean;
  performanceData?: PuzzlePerformanceSnapshot;
}

interface PuzzlePerformanceSnapshot {
  wrongCount: number;           // "Wins" for puzzle (LLM failures)
  avgAccuracy: number;          // Average LLM accuracy (0-1)
  totalExplanations: number;    // Total attempts
  negativeFeedback: number;
  totalFeedback: number;
  latestAnalysis: string | null;
  modelsAttempted?: string[];   // Which models tried
  // ... other metrics
}
```

### 2.2 Win/Loss Calculation Logic

```typescript
// For each puzzle:
const totalAttempts = performanceData.totalExplanations || 0;
const puzzleWins = performanceData.wrongCount || 0; // LLM failures = puzzle wins
const puzzleLosses = totalAttempts - puzzleWins;    // LLM successes = puzzle losses

// Format: "14-4" means puzzle beat LLMs 14 times, lost 4 times
const record = `${puzzleWins}-${puzzleLosses}`;
```

### 2.3 Data Filtering

1. Fetch all puzzles from `/api/puzzles/stats`
2. Filter: `puzzles.filter(p => hasPuzzleName(p.id))`
3. Filter: `puzzles.filter(p => p.performanceData?.totalExplanations > 0)`
4. Sort by win count descending (hardest puzzles first)

---

## 3. Component Implementation

### 3.1 Page Component: `PuzzleTradingCards.tsx`

**File:** `client/src/pages/PuzzleTradingCards.tsx`

**Purpose:** Main page for trading card display

**Structure:**
```typescript
export default function PuzzleTradingCards() {
  const [datasetFilter, setDatasetFilter] = useState<string>('any');
  const [sortBy, setSortBy] = useState<string>('wins_desc');
  
  const { data, isLoading, summary } = usePuzzleStats();
  
  const namedPuzzles = useMemo(() => {
    if (!data?.puzzles) return [];
    
    return data.puzzles
      .filter(p => hasPuzzleName(p.id))
      .filter(p => (p.performanceData?.totalExplanations || 0) > 0)
      .filter(p => datasetFilter === 'any' || p.source === datasetFilter)
      .sort((a, b) => {
        // Sort by win count, accuracy, etc.
      });
  }, [data, datasetFilter, sortBy]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-100">
      {/* Header */}
      <header>
        <CollapsibleMission />
        <EmojiMosaicAccent pattern={BASEBALL_EMOJI_PATTERN} />
      </header>
      
      {/* Filters */}
      <section className="filters">
        {/* Dataset dropdown */}
        {/* Sort dropdown */}
      </section>
      
      {/* Card Gallery */}
      <section className="card-gallery">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {namedPuzzles.map(puzzle => (
            <PuzzleTradingCard key={puzzle.id} puzzle={puzzle} />
          ))}
        </div>
      </section>
    </div>
  );
}
```

### 3.2 Card Component: `PuzzleTradingCard.tsx`

**File:** `client/src/components/puzzle/PuzzleTradingCard.tsx`

**Purpose:** Individual trading card with 1980s Topps aesthetic

**Key Features:**
- Vintage border styling
- Grid displayed prominently
- Win/loss record prominently displayed
- Expands on click for detailed stats

**Structure:**
```typescript
interface PuzzleTradingCardProps {
  puzzle: PuzzleStatsRecord;
}

export function PuzzleTradingCard({ puzzle }: PuzzleTradingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [taskData, setTaskData] = useState<ARCTask | null>(null);
  
  // Load grid data when card becomes visible
  useEffect(() => {
    fetch(`/api/puzzle/task/${puzzle.id}`)
      .then(res => res.json())
      .then(data => setTaskData(data.data));
  }, [puzzle.id]);
  
  const puzzleName = getPuzzleName(puzzle.id);
  const wins = puzzle.performanceData?.wrongCount || 0;
  const losses = (puzzle.performanceData?.totalExplanations || 0) - wins;
  const record = `${wins}-${losses}`;
  const teamName = formatTeamName(puzzle.source);
  
  return (
    <div 
      className="trading-card"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Card Front (always visible) */}
      <div className="card-front">
        {/* Vintage border treatment */}
        <div className="vintage-border">
          
          {/* Main puzzle grid (hero) */}
          <div className="grid-display">
            {taskData?.train[0] && (
              <TinyGrid grid={taskData.train[0].input} />
            )}
          </div>
          
          {/* Official ID (small) */}
          <div className="puzzle-id">{puzzle.id}</div>
          
          {/* Nickname (large) */}
          <h2 className="puzzle-name">{puzzleName}</h2>
          
          {/* Team badge */}
          <div className="team-badge">{teamName}</div>
          
          {/* Win/Loss Record (prominent) */}
          <div className="record">
            <span className="record-label">Record</span>
            <span className="record-value">{record}</span>
          </div>
        </div>
      </div>
      
      {/* Card Back (expandable) */}
      {isExpanded && (
        <div className="card-back">
          <h3>Performance Statistics</h3>
          
          {/* Detailed stats */}
          <div className="stats-grid">
            <StatRow label="Total Attempts" value={puzzle.performanceData.totalExplanations} />
            <StatRow label="Wins (LLM Failures)" value={wins} />
            <StatRow label="Losses (LLM Successes)" value={losses} />
            <StatRow label="Avg LLM Accuracy" value={`${(puzzle.performanceData.avgAccuracy * 100).toFixed(1)}%`} />
          </div>
          
          {/* Models that failed */}
          <div className="failed-models">
            <h4>Models that Failed</h4>
            {/* List models with wrong predictions */}
          </div>
          
          {/* Models that succeeded */}
          <div className="successful-models">
            <h4>Models that Succeeded</h4>
            {/* List models with correct predictions */}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 4. Styling: 1980s Topps Baseball Card Aesthetic

### 4.1 Color Palette

**Primary Colors (Topps-inspired):**
- Border: `#d4a574` (tan/beige cardboard)
- Inner Border: `#8b4513` (saddle brown)
- Background: `#f5f5dc` (beige/cream)
- Text: `#2c1810` (dark brown)
- Accent: `#c41e3a` (vintage red)

**Team Colors (by dataset):**
- ARC1: Blue/Navy
- ARC2: Red/Burgundy
- ARC-Heavy: Green/Forest
- ConceptARC: Purple/Violet

### 4.2 Typography

```typescript
// Card styling constants
const CARD_STYLES = {
  // Official ID (small, serif)
  puzzleId: 'font-serif text-xs text-gray-600 tracking-wider',
  
  // Nickname (large, bold, uppercase)
  puzzleName: 'font-sans text-2xl font-bold uppercase tracking-tight text-gray-900',
  
  // Record (large, impact-style)
  record: 'font-mono text-4xl font-black text-red-700',
  
  // Team badge
  team: 'font-sans text-sm font-semibold uppercase tracking-wide',
};
```

### 4.3 Border & Shadow Effects

```css
/* Vintage card treatment */
.trading-card {
  /* Rounded corners (subtle) */
  border-radius: 12px;
  
  /* Double border (Topps signature) */
  border: 4px solid #d4a574;
  box-shadow: 
    inset 0 0 0 2px #8b4513,    /* Inner brown border */
    0 4px 8px rgba(0,0,0,0.2),  /* Drop shadow */
    0 1px 3px rgba(0,0,0,0.1);  /* Subtle depth */
  
  /* Aged paper texture */
  background: linear-gradient(
    135deg,
    #f5f5dc 0%,
    #fffaf0 50%,
    #f5f5dc 100%
  );
  
  /* Slight texture overlay */
  background-image: 
    url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.05' /%3E%3C/svg%3E");
  
  /* Hover effect (lift & glow) */
  transition: all 0.3s ease;
  cursor: pointer;
}

.trading-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 
    inset 0 0 0 2px #8b4513,
    0 12px 24px rgba(0,0,0,0.3),
    0 4px 8px rgba(0,0,0,0.2);
}

/* Expanded card (flip effect) */
.trading-card.expanded {
  transform: rotateY(180deg);
}
```

### 4.4 Layout Reference (Topps-style)

```
┌─────────────────────────────────────┐
│  ╔═══════════════════════════════╗  │ <- Outer border (tan)
│  ║                               ║  │
│  ║   ┌───────────────────────┐   ║  │ <- Inner border (brown)
│  ║   │  [PUZZLE GRID]        │   ║  │
│  ║   │   (Prominent)         │   ║  │
│  ║   └───────────────────────┘   ║  │
│  ║                               ║  │
│  ║   007bbfb7                    ║  │ <- ID (small)
│  ║   FRACTAL                     ║  │ <- Name (LARGE)
│  ║                               ║  │
│  ║   ┌─────────────┐             ║  │
│  ║   │ ARC1 EVAL   │ Team badge  ║  │
│  ║   └─────────────┘             ║  │
│  ║                               ║  │
│  ║   ╔═══════════╗               ║  │
│  ║   ║  RECORD   ║               ║  │
│  ║   ║   14-4    ║ <- Win/Loss  ║  │
│  ║   ╚═══════════╝               ║  │
│  ╚═══════════════════════════════╝  │
└─────────────────────────────────────┘
```

---

## 5. Routing Setup

### 5.1 Add Route to App.tsx

**File:** `client/src/App.tsx`

```typescript
// Add import
import PuzzleTradingCards from "@/pages/PuzzleTradingCards";

// Add route (after existing puzzle routes)
<Route path="/puzzle-cards" component={PuzzleTradingCards} />
```

### 5.2 Navigation Integration

**Add link to main navigation:**
- Update `PageLayout.tsx` or navigation component
- Add menu item: "Trading Cards" or "Puzzle Cards"
- Icon suggestion: `<Trophy />` or `<Award />` from lucide-react

---

## 6. Data Modeling & Utilities

### 6.1 Helper Functions

**File:** `client/src/utils/puzzleCardHelpers.ts`

```typescript
/**
 * Calculate win/loss record for a puzzle
 * Wins = times LLMs failed
 * Losses = times LLMs succeeded
 */
export function calculatePuzzleRecord(performanceData?: PuzzlePerformanceSnapshot): {
  wins: number;
  losses: number;
  record: string;
  winPercentage: number;
} {
  if (!performanceData?.totalExplanations) {
    return { wins: 0, losses: 0, record: '0-0', winPercentage: 0 };
  }
  
  const wins = performanceData.wrongCount || 0;
  const losses = performanceData.totalExplanations - wins;
  const winPercentage = (wins / performanceData.totalExplanations) * 100;
  
  return {
    wins,
    losses,
    record: `${wins}-${losses}`,
    winPercentage
  };
}

/**
 * Format dataset source as "team name"
 */
export function formatTeamName(source?: string): string {
  if (!source) return 'Unknown';
  
  const teamNames: Record<string, string> = {
    'ARC1': 'ARC-1 League',
    'ARC1-Eval': 'ARC-1 Evaluation',
    'ARC2': 'ARC-2 League',
    'ARC2-Eval': 'ARC-2 Evaluation',
    'ARC-Heavy': 'Heavy Division',
    'ConceptARC': 'Concept League'
  };
  
  return teamNames[source] || source;
}

/**
 * Get team color for dataset
 */
export function getTeamColor(source?: string): {
  primary: string;
  secondary: string;
  text: string;
} {
  const colors: Record<string, any> = {
    'ARC1': { primary: '#1e3a8a', secondary: '#3b82f6', text: 'text-blue-900' },
    'ARC1-Eval': { primary: '#1e40af', secondary: '#60a5fa', text: 'text-blue-800' },
    'ARC2': { primary: '#991b1b', secondary: '#ef4444', text: 'text-red-900' },
    'ARC2-Eval': { primary: '#b91c1c', secondary: '#f87171', text: 'text-red-800' },
    'ARC-Heavy': { primary: '#14532d', secondary: '#22c55e', text: 'text-green-900' },
    'ConceptARC': { primary: '#581c87', secondary: '#a855f7', text: 'text-purple-900' }
  };
  
  return colors[source || ''] || { primary: '#6b7280', secondary: '#9ca3af', text: 'text-gray-900' };
}
```

### 6.2 Sorting Options

```typescript
type SortOption = 
  | 'wins_desc'      // Most wins first (hardest puzzles)
  | 'wins_asc'       // Least wins first (easiest puzzles)
  | 'attempts_desc'  // Most attempted
  | 'accuracy_asc'   // Lowest LLM accuracy (hardest)
  | 'accuracy_desc'  // Highest LLM accuracy (easiest)
  | 'name_asc';      // Alphabetical by name

function sortPuzzles(puzzles: PuzzleStatsRecord[], sortBy: SortOption) {
  return [...puzzles].sort((a, b) => {
    switch (sortBy) {
      case 'wins_desc':
        return (b.performanceData?.wrongCount || 0) - (a.performanceData?.wrongCount || 0);
      case 'wins_asc':
        return (a.performanceData?.wrongCount || 0) - (b.performanceData?.wrongCount || 0);
      case 'attempts_desc':
        return (b.performanceData?.totalExplanations || 0) - (a.performanceData?.totalExplanations || 0);
      case 'accuracy_asc':
        return (a.performanceData?.avgAccuracy || 0) - (b.performanceData?.avgAccuracy || 0);
      case 'accuracy_desc':
        return (b.performanceData?.avgAccuracy || 0) - (a.performanceData?.avgAccuracy || 0);
      case 'name_asc':
        return (getPuzzleName(a.id) || a.id).localeCompare(getPuzzleName(b.id) || b.id);
      default:
        return 0;
    }
  });
}
```

---

## 7. Component Reuse Analysis

### 7.1 Reused Components

| Component | Source | Purpose |
|-----------|--------|---------|
| `TinyGrid` | `client/src/components/puzzle/TinyGrid.tsx` | Render puzzle grids |
| `CollapsibleMission` | `client/src/components/ui/collapsible-mission.tsx` | Page header |
| `EmojiMosaicAccent` | `client/src/components/browser/EmojiMosaicAccent.tsx` | Decorative header |
| `CollapsibleCard` | `client/src/components/ui/collapsible-card.tsx` | Expansion pattern |

### 7.2 Reused Hooks

| Hook | Source | Purpose |
|------|--------|---------|
| `usePuzzleStats` | `client/src/hooks/usePuzzleStats.ts` | Fetch puzzle data with performance metrics |

### 7.3 Reused Utilities

| Utility | Source | Purpose |
|---------|--------|---------|
| `getPuzzleName` | `shared/utils/puzzleNames.ts` | Get friendly name for puzzle ID |
| `hasPuzzleName` | `shared/utils/puzzleNames.ts` | Check if puzzle has a name |
| `PUZZLE_NAMES` | `shared/utils/puzzleNames.ts` | Name lookup dictionary |

### 7.4 Patterns from Existing Components

**From `PuzzleCard.tsx`:**
- Lazy loading pattern for grid data
- Intersection observer for performance
- Status-driven gradient styling
- Hover effects and transitions

**From `AnalysisResultCard.tsx`:**
- Expandable sections with state management
- Stats display patterns
- Badge/label styling
- Metric presentation

**From `PuzzleBrowser.tsx`:**
- Filter section layout
- Grid gallery pattern
- Loading states
- Error handling

---

## 8. Implementation Steps

### Phase 1: Core Structure (Day 1)

1. **Create page component**
   - [ ] Create `client/src/pages/PuzzleTradingCards.tsx`
   - [ ] Add file header with author/purpose/SRP-DRY check
   - [ ] Set up basic layout structure
   - [ ] Add route to `App.tsx`

2. **Create card component**
   - [ ] Create `client/src/components/puzzle/PuzzleTradingCard.tsx`
   - [ ] Add file header
   - [ ] Implement basic card structure
   - [ ] Add expansion state management

3. **Create helper utilities**
   - [ ] Create `client/src/utils/puzzleCardHelpers.ts`
   - [ ] Implement `calculatePuzzleRecord()`
   - [ ] Implement `formatTeamName()`
   - [ ] Implement `getTeamColor()`

### Phase 2: Data Integration (Day 1-2)

4. **Connect data sources**
   - [ ] Import and use `usePuzzleStats()` hook
   - [ ] Filter for named puzzles only
   - [ ] Filter for puzzles with performance data
   - [ ] Calculate win/loss records

5. **Implement card data display**
   - [ ] Load grid data for each card
   - [ ] Display puzzle name/ID
   - [ ] Display dataset as "team"
   - [ ] Display win/loss record
   - [ ] Add lazy loading for grids

### Phase 3: Styling (Day 2)

6. **Apply vintage baseball card aesthetic**
   - [ ] Create vintage border treatment
   - [ ] Add double border effect
   - [ ] Apply aged paper background
   - [ ] Add subtle texture overlay
   - [ ] Implement team-based color theming

7. **Add typography and layout**
   - [ ] Style puzzle ID (small, serif)
   - [ ] Style puzzle name (large, bold, uppercase)
   - [ ] Style win/loss record (prominent, impact-style)
   - [ ] Position elements like classic Topps cards
   - [ ] Add team badge styling

8. **Implement interactions**
   - [ ] Add hover effects (lift & glow)
   - [ ] Add click-to-expand functionality
   - [ ] Implement card flip animation
   - [ ] Add smooth transitions

### Phase 4: Expanded Details (Day 2-3)

9. **Build card back (expanded view)**
   - [ ] Create detailed stats section
   - [ ] List models that failed (puzzle wins)
   - [ ] List models that succeeded (puzzle losses)
   - [ ] Add performance breakdown
   - [ ] Add close/collapse functionality

10. **Add filters and sorting**
    - [ ] Dataset filter dropdown
    - [ ] Sort options dropdown
    - [ ] Apply filters to puzzle list
    - [ ] Add active filter indicators

### Phase 5: Polish & Testing (Day 3)

11. **UI refinement**
    - [ ] Add loading states
    - [ ] Add empty states
    - [ ] Add error handling
    - [ ] Responsive layout adjustments
    - [ ] Accessibility improvements

12. **Performance optimization**
    - [ ] Implement virtual scrolling (if needed)
    - [ ] Optimize grid loading
    - [ ] Add intersection observer for cards
    - [ ] Test with large datasets

13. **Documentation**
    - [ ] Add JSDoc comments
    - [ ] Update README if needed
    - [ ] Document styling constants
    - [ ] Add usage examples

---

## 9. Technical Considerations

### 9.1 Performance

**Concerns:**
- Loading 400+ puzzle grids could be slow
- Each card needs to fetch grid data

**Solutions:**
1. **Lazy Loading:** Only load grid data when card is visible
2. **Intersection Observer:** Monitor card visibility
3. **Caching:** Cache loaded grids in component state
4. **Virtual Scrolling:** If list is very long (>100 cards)
5. **Pagination:** Consider paginating cards (e.g., 50 per page)

### 9.2 Data Availability

**Only show puzzles with:**
1. A friendly name in `PUZZLE_NAMES`
2. Performance data (`totalExplanations > 0`)
3. At least one model attempt

**This filters ~400 named puzzles down to ~200-300 with actual data**

### 9.3 Accessibility

- [ ] Keyboard navigation for cards
- [ ] ARIA labels for screen readers
- [ ] Focus management for expanded cards
- [ ] Color contrast compliance (WCAG AA)
- [ ] Alt text for grid visualizations

### 9.4 Mobile Responsiveness

- [ ] Single column on mobile
- [ ] Two columns on tablet
- [ ] Three/four columns on desktop
- [ ] Touch-friendly tap targets
- [ ] Optimized card size for small screens

---

## 10. Future Enhancements

### V2 Features (Post-MVP)

1. **Search Functionality**
   - Search by puzzle name or ID
   - Filter by win/loss threshold
   - Filter by team (dataset)

2. **Advanced Stats**
   - Difficulty rating
   - Most-failed-by model
   - Trend over time (if historical data available)
   - Success rate by reasoning approach

3. **Sharing**
   - Share individual cards
   - Download card as image
   - Social media integration

4. **Collections**
   - "Undefeated Champions" (100% win rate)
   - "Glass Cannons" (high attempts, high variance)
   - "Rookie Cards" (new puzzles, few attempts)

5. **Comparison Mode**
   - Compare two puzzle cards side-by-side
   - Show relative difficulty
   - Highlight similar patterns

---

## 11. File Manifest

### New Files to Create

```
client/src/pages/PuzzleTradingCards.tsx
client/src/components/puzzle/PuzzleTradingCard.tsx
client/src/utils/puzzleCardHelpers.ts
docs/plans/puzzle-browser/2025-11-14-puzzle-trading-cards-feature-plan.md (this file)
```

### Files to Modify

```
client/src/App.tsx                    (add route)
client/src/components/layout/PageLayout.tsx (optional: add nav link)
```

### Files Referenced (No Changes)

```
client/src/hooks/usePuzzleStats.ts
client/src/components/puzzle/TinyGrid.tsx
client/src/components/ui/collapsible-mission.tsx
client/src/components/browser/EmojiMosaicAccent.tsx
shared/utils/puzzleNames.ts
server/repositories/AccuracyRepository.ts (for understanding data)
```

---

## 12. Testing Checklist

### Unit Tests
- [ ] `calculatePuzzleRecord()` returns correct values
- [ ] `formatTeamName()` handles all dataset types
- [ ] `getTeamColor()` returns valid colors
- [ ] Card component renders with minimal props
- [ ] Expansion state toggles correctly

### Integration Tests
- [ ] Page loads without errors
- [ ] Data fetches correctly from API
- [ ] Cards filter by dataset
- [ ] Cards sort by various criteria
- [ ] Grid data loads lazily

### Visual/Manual Tests
- [ ] Cards display in grid layout
- [ ] Vintage styling matches Topps aesthetic
- [ ] Hover effects work smoothly
- [ ] Expansion animation is smooth
- [ ] Colors match team themes
- [ ] Typography is readable
- [ ] Mobile layout works correctly

### Performance Tests
- [ ] Page loads in <2 seconds
- [ ] Scrolling is smooth
- [ ] No memory leaks on repeated expansions
- [ ] Grid images load progressively

---

## 13. Success Metrics

### MVP Success Criteria

1. **Functionality**
   - ✓ All named puzzles with data are displayed
   - ✓ Win/loss records calculate correctly
   - ✓ Cards expand to show details
   - ✓ Filtering and sorting work

2. **Visual Design**
   - ✓ Cards have 1980s Topps aesthetic
   - ✓ Vintage border treatment applied
   - ✓ Team colors distinguish datasets
   - ✓ Typography creates hierarchy

3. **Performance**
   - ✓ Initial page load <3 seconds
   - ✓ Card interactions feel instant (<100ms)
   - ✓ Smooth scrolling with 200+ cards

4. **Code Quality**
   - ✓ All components pass SRP check
   - ✓ No code duplication (DRY)
   - ✓ Proper file headers
   - ✓ TypeScript types enforced

---

## 14. Open Questions

### Design Decisions Needed

1. **Card Expansion Method:**
   - Option A: Modal overlay (like detail view)
   - Option B: In-place expansion (pushes other cards)
   - Option C: Flip animation (card back)
   - **Recommendation:** Option C (most "trading card" feel)

2. **Default Sort Order:**
   - Option A: Most wins first (hardest puzzles)
   - Option B: Alphabetical by name
   - Option C: Most attempts first (most popular)
   - **Recommendation:** Option A (showcases difficulty)

3. **Empty State Handling:**
   - What if no named puzzles have performance data?
   - **Recommendation:** Show message encouraging puzzle analysis

4. **Navigation Placement:**
   - Add to main nav?
   - Add as sub-item under "Browser"?
   - **Recommendation:** Main nav item for visibility

---

## 15. Dependencies

### NPM Packages (All Existing)
- `react` - Core framework
- `wouter` - Routing
- `@tanstack/react-query` - Data fetching
- `lucide-react` - Icons
- `tailwindcss` - Styling

### Internal Dependencies (All Existing)
- `usePuzzleStats` hook
- `TinyGrid` component
- `puzzleNames` utility
- `CollapsibleCard` component
- `/api/puzzles/stats` endpoint

**No new dependencies required!**

---

## Appendix A: Example Card Data

```typescript
// Example puzzle from API
const examplePuzzle: PuzzleStatsRecord = {
  id: '007bbfb7',
  source: 'ARC1-Eval',
  hasExplanation: true,
  performanceData: {
    wrongCount: 14,              // LLM failures = puzzle wins
    totalExplanations: 18,       // Total attempts
    avgAccuracy: 0.222,          // 22.2% LLM success rate
    avgConfidence: 65,
    modelsAttempted: [
      'openai/gpt-4o',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-1.5-pro',
      // ... more models
    ],
    negativeFeedback: 3,
    totalFeedback: 7,
    latestAnalysis: '2025-11-10T14:30:00Z',
    compositeScore: 12.5
  }
};

// Calculated card data
const cardData = {
  id: '007bbfb7',
  name: 'fractal',              // From PUZZLE_NAMES
  team: 'ARC-1 Evaluation',     // From formatTeamName()
  wins: 14,                      // wrongCount
  losses: 4,                     // totalExplanations - wrongCount
  record: '14-4',                // Display format
  winPercentage: 77.8,           // (14/18) * 100
  teamColor: {
    primary: '#1e40af',          // Blue for ARC1-Eval
    secondary: '#60a5fa',
    text: 'text-blue-800'
  }
};
```

---

## Appendix B: Styling Constants

```typescript
// Trading card styling constants
export const CARD_DIMENSIONS = {
  width: '320px',
  height: '480px',
  aspectRatio: '2 / 3'
};

export const VINTAGE_COLORS = {
  cardboard: '#d4a574',
  innerBorder: '#8b4513',
  background: '#f5f5dc',
  darkText: '#2c1810',
  accentRed: '#c41e3a'
};

export const TEAM_COLORS = {
  'ARC1': { primary: '#1e3a8a', secondary: '#3b82f6' },
  'ARC1-Eval': { primary: '#1e40af', secondary: '#60a5fa' },
  'ARC2': { primary: '#991b1b', secondary: '#ef4444' },
  'ARC2-Eval': { primary: '#b91c1c', secondary: '#f87171' },
  'ARC-Heavy': { primary: '#14532d', secondary: '#22c55e' },
  'ConceptARC': { primary: '#581c87', secondary: '#a855f7' }
};

export const TYPOGRAPHY = {
  puzzleId: 'font-serif text-xs uppercase tracking-widest',
  puzzleName: 'font-sans text-2xl font-black uppercase tracking-tight',
  record: 'font-mono text-5xl font-black tabular-nums',
  teamBadge: 'font-sans text-sm font-bold uppercase tracking-wide',
  stats: 'font-mono text-sm tabular-nums'
};
```

---

**End of Implementation Plan**
