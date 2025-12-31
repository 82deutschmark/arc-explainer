# RE-ARC Efficiency Visualization Plan

**Author:** Claude Opus 4.5
**Date:** 2025-12-31
**Status:** Planning
**Related:** RE-ARC Bench, `/re-arc` route, `/re-arc/leaderboard` route

---

## Overview

Add a 2D scatter plot visualization to RE-ARC leaderboard inspired by ARC Prize's analysis approach. This shifts focus from pure competition to efficiency analysis.

**Key insight:** The `seedId` encoded in task IDs IS a Unix timestamp (seconds) from generation time. We already have everything needed to calculate elapsed time.

---

## Visualization Design

### Scatter Plot
- **Y-axis:** Score (0-100%)
- **X-axis:** Elapsed time (generation → submission)
- **Each point:** One submission
- **Hover tooltip:** Solver name, exact score, exact time, tasks/pairs solved

### Interpretation
- **Top-left corner:** High score, fast time = excellent
- **Top-right corner:** High score, slow time = thorough but slow
- **Bottom-left:** Low score, fast time = quick but ineffective
- **Bottom-right:** Low score, slow time = struggling

---

## Technical Implementation

### 1. No Database Changes Needed

The generation timestamp is already encoded:
- `seedId = Math.floor(Date.now() / 1000)` (Unix seconds) — set at generation time
- `evaluated_at` — set at submission time
- **Elapsed = evaluated_at - (seedId * 1000)**

The `rearc_datasets.seed_id` column stores this value. We just need to expose it.

### 2. Backend Changes

#### A. Repository (`ReArcRepository.ts`)

Add `generatedAt` to `LeaderboardEntry` interface:

```typescript
export interface LeaderboardEntry {
  // ... existing fields ...
  generatedAt: Date;  // NEW: derived from seed_id
  elapsedMs: number;  // NEW: evaluated_at - generated_at
}
```

Update `getLeaderboard()` query to include seed_id conversion:

```sql
SELECT
  s.id, s.solver_name, s.score, s.solved_pairs, s.total_pairs, s.tasks_solved,
  s.evaluated_at, s.verification_count, d.seed_id,
  -- Convert seed_id (Unix seconds) to timestamp
  to_timestamp(d.seed_id::bigint) as generated_at
FROM rearc_submissions s
JOIN rearc_datasets d ON s.rearc_dataset_id = d.id
...
```

Calculate `elapsedMs` in the mapping:

```typescript
const entries: LeaderboardEntry[] = entriesResult.rows.map(row => ({
  // ... existing fields ...
  generatedAt: row.generated_at,
  elapsedMs: row.evaluated_at.getTime() - row.generated_at.getTime(),
}));
```

#### B. Controller (`reArcLeaderboardController.ts`)

Ensure the new fields are included in API response. No changes needed if repository is updated correctly.

### 3. Frontend Changes

#### A. Update Types (`ReArcLeaderboard.tsx`)

```typescript
interface LeaderboardEntry {
  // ... existing fields ...
  generatedAt: string;
  elapsedMs: number;
}
```

#### B. Add Elapsed Time Column to Table

```tsx
<TableHead className="text-right">Time</TableHead>
// ...
<TableCell className="text-right text-muted-foreground">
  {formatElapsedTime(entry.elapsedMs)}
</TableCell>
```

Helper function:

```typescript
function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
```

#### C. Create Scatter Plot Component

New file: `client/src/components/rearc/EfficiencyPlot.tsx`

Use recharts (already a common choice with shadcn/ui):

```tsx
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface EfficiencyPlotProps {
  data: Array<{
    solverName: string;
    score: number;
    elapsedMs: number;
  }>;
}

export function EfficiencyPlot({ data }: EfficiencyPlotProps) {
  // Transform data for recharts
  const plotData = data.map(d => ({
    x: d.elapsedMs / 1000 / 60, // Convert to minutes for display
    y: d.score * 100,           // Convert to percentage
    name: d.solverName,
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ScatterChart>
        <XAxis
          dataKey="x"
          name="Time"
          unit=" min"
          label={{ value: 'Elapsed Time (minutes)', position: 'bottom' }}
        />
        <YAxis
          dataKey="y"
          name="Score"
          unit="%"
          domain={[0, 100]}
          label={{ value: 'Score (%)', angle: -90, position: 'left' }}
        />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          formatter={(value, name) => [
            name === 'x' ? `${value} min` : `${value}%`,
            name === 'x' ? 'Time' : 'Score'
          ]}
        />
        <Scatter name="Submissions" data={plotData} fill="#8884d8" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
```

#### D. Integrate Plot into Leaderboard Page

Add toggle or tabs to switch between table view and plot view:

```tsx
const [view, setView] = useState<'table' | 'plot'>('table');

// In JSX:
<div className="flex gap-2 mb-4">
  <Button
    variant={view === 'table' ? 'default' : 'outline'}
    onClick={() => setView('table')}
  >
    Table
  </Button>
  <Button
    variant={view === 'plot' ? 'default' : 'outline'}
    onClick={() => setView('plot')}
  >
    Efficiency Plot
  </Button>
</div>

{view === 'table' ? (
  // Existing table
) : (
  <EfficiencyPlot data={data.submissions} />
)}
```

---

## Implementation Phases

### Phase 1: Backend Data
- [ ] Update `LeaderboardEntry` interface with `generatedAt` and `elapsedMs`
- [ ] Modify repository query to compute generated_at from seed_id
- [ ] Calculate elapsedMs in result mapping
- [ ] Test API returns new fields

### Phase 2: Table Enhancement
- [ ] Add elapsed time column to leaderboard table
- [ ] Create `formatElapsedTime()` helper function
- [ ] Update frontend types

### Phase 3: Visualization
- [ ] Install recharts if not already present
- [ ] Create `EfficiencyPlot.tsx` component
- [ ] Add view toggle to leaderboard page
- [ ] Style plot to match site theme

### Phase 4: Polish
- [ ] Add hover interactions to scatter points
- [ ] Consider log scale for time axis (submissions may span seconds to days)
- [ ] Add quadrant labels or reference lines
- [ ] Mobile responsiveness (plot may need different layout)

---

## Files to Modify

**Backend:**
- `server/repositories/ReArcRepository.ts` — Add generatedAt/elapsedMs to LeaderboardEntry

**Frontend:**
- `client/src/pages/ReArcLeaderboard.tsx` — Add elapsed column, view toggle, integrate plot
- `client/src/components/rearc/EfficiencyPlot.tsx` — NEW: Scatter plot component

**Possibly:**
- `package.json` — Add recharts dependency if not present

---

## Edge Cases

1. **Very short times (<1 second):** Format as "< 1s"
2. **Very long times (>30 days):** Consider if these are valid or abandoned attempts
3. **Negative elapsed time:** Should be impossible (eval happens after generation), but guard against it
4. **Clock skew:** If user's system clock is off, seedId may be incorrect. Accept as a limitation.

---

## Success Criteria

- Leaderboard shows elapsed time column
- Users can toggle between table and scatter plot views
- Plot clearly shows score vs efficiency tradeoff
- Tooltips provide detailed submission info on hover
- Works with existing data (no migration needed)

---

## Notes

- This approach treats elapsed time as "efficiency" — faster submissions with same score are better
- The scatter plot enables quick visual identification of outliers and patterns
- Does NOT require users to explicitly report timing — it's computed from timestamps already in the system
