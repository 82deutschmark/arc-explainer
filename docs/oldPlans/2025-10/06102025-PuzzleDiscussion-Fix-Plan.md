# PuzzleDiscussion Page Fix Plan
**Date:** 2025-10-06  
**Author:** Cascade using Sonnet 4  
**Purpose:** Complete redesign of PuzzleDiscussion to focus on action, not explanation

## Current Problems

### 1. No Search - Just Walls of Text
- Landing page has 60 lines of feature explanation (PuzzleDiscussion.tsx lines 245-294)
- No search box visible (hidden in wrong component)
- No table of recent eligible explanations

### 2. No Filtering of Eligible Explanations
- Shows ALL explanations from database
- Should ONLY show explanations that are:
  - ✅ Less than 30 days old (`created_at` check)
  - ✅ From reasoning models (GPT-5, o-series, Grok-4)
  - ✅ Has `provider_response_id` (required for chaining)
  
### 3. Wrong UI Text Everywhere
- **PuzzleDebateHeader:** "Enter puzzle ID to start debate..." → Should be "Enter puzzle ID..."
- **AnalysisResultListCard:** "Start Debate" button → Should be "Start Refinement"
- **ExplanationsList:** Two massive alert boxes explaining features

### 4. Component Reuse Gone Wrong
- Reusing ModelDebate components is good (DRY)
- But components need `pageContext` prop to show correct text
- AnalysisResultListCard doesn't accept `pageContext` - always says "Start Debate"

---

## Solution: Phased Fix

### Phase 1: Create Backend API for Eligible Explanations

**New Endpoint:** `GET /api/discussion/eligible`

**Query params:**
- `limit` (default 20)
- `offset` (for pagination)

**Returns:**
```typescript
{
  explanations: Array<{
    id: number;
    puzzleId: string;
    modelName: string;
    provider: 'openai' | 'xai';
    createdAt: string;
    daysOld: number;
    hasProviderResponseId: boolean;
    confidence: number;
  }>
}
```

**SQL Query:**
```sql
SELECT 
  id, puzzle_id, model_name, 
  provider_response_id IS NOT NULL as has_provider_response_id,
  created_at, confidence,
  EXTRACT(DAY FROM NOW() - created_at) as days_old
FROM explanations
WHERE 
  created_at >= NOW() - INTERVAL '30 days'
  AND provider_response_id IS NOT NULL
  AND (
    LOWER(model_name) LIKE '%gpt-5%'
    OR LOWER(model_name) LIKE '%o3%'
    OR LOWER(model_name) LIKE '%o4%'
    OR LOWER(model_name) LIKE '%grok-4%'
  )
ORDER BY created_at DESC
LIMIT ? OFFSET ?
```

**Files to create/modify:**
- `server/controllers/discussionController.ts` - NEW
- `server/routes.ts` - Add discussion routes
- `client/src/hooks/useEligibleExplanations.ts` - NEW

---

### Phase 2: Fix AnalysisResultListCard Button Text

**Problem:** Hard-coded "Start Debate" text doesn't change based on context

**Solution:** Add `buttonText` prop

**Changes to AnalysisResultListCard.tsx:**
```typescript
interface AnalysisResultListCardProps {
  // ... existing props
  onStartDebate?: (id: number) => void;
  showDebateButton?: boolean;
  debateButtonText?: string; // NEW: Allow custom button text
}

// Inside component:
{showDebateButton && canDebate && (
  <Button onClick={handleDebateClick}>
    <MessageSquare />
    {debateButtonText || 'Start Debate'} {/* Use prop or default */}
  </Button>
)}
```

**Update ExplanationsList.tsx:**
```typescript
<AnalysisResultListCard
  debateButtonText={pageContext === 'discussion' ? 'Start Refinement' : 'Start Debate'}
/>
```

---

### Phase 3: Redesign Landing Page

**Replace lines 233-305 in PuzzleDiscussion.tsx:**

```typescript
if (!taskId) {
  return (
    <div className="w-full space-y-4">
      {/* Simple Search Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-600" />
            Progressive Reasoning
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Refine AI analyses through multi-turn conversations with full server-side reasoning retention (30 days).
            Supports OpenAI GPT-5, o-series, and xAI Grok-4 models.
          </p>
          
          {/* Search Box */}
          <form onSubmit={handlePuzzleSearch} className="flex gap-2">
            <Input
              placeholder="Enter puzzle ID to begin..."
              value={searchPuzzleId}
              onChange={(e) => setSearchPuzzleId(e.target.value)}
            />
            <Button type="submit">
              <Search className="h-4 w-4 mr-2" />
              Go
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Recent Eligible Explanations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Eligible Analyses</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingEligible ? (
            <Loader2 className="animate-spin" />
          ) : eligibleExplanations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Puzzle ID</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eligibleExplanations.map(exp => (
                  <TableRow key={exp.id}>
                    <TableCell>
                      <Link href={`/discussion/${exp.puzzleId}`}>
                        {exp.puzzleId}
                      </Link>
                    </TableCell>
                    <TableCell>{exp.modelName}</TableCell>
                    <TableCell>
                      <Badge>{exp.provider.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{exp.daysOld}d ago</Badge>
                    </TableCell>
                    <TableCell>
                      <Button 
                        size="sm" 
                        onClick={() => navigate(`/discussion/${exp.puzzleId}?select=${exp.id}`)}
                      >
                        Refine
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No eligible analyses found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### Phase 4: Filter Explanations on Puzzle Page

**Add client-side filtering in PuzzleDiscussion.tsx:**

```typescript
// Filter explanations to only show eligible ones
const eligibleExplanations = useMemo(() => {
  if (!explanations) return [];
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return explanations.filter(exp => {
    // Must be less than 30 days old
    const createdAt = new Date(exp.createdAt);
    if (createdAt < thirtyDaysAgo) return false;
    
    // Must be from reasoning model
    if (!isReasoningModel(exp.modelName)) return false;
    
    // Must have provider response ID
    if (!exp.providerResponseId) return false;
    
    return true;
  });
}, [explanations]);

// Use eligibleExplanations instead of explanations in UI
```

**Update ExplanationsList call:**
```typescript
<ExplanationsList
  explanations={eligibleExplanations} {/* Filtered list */}
  pageContext="discussion"
/>
```

**Add warning if no eligible explanations:**
```typescript
{eligibleExplanations.length === 0 && explanations && explanations.length > 0 && (
  <Alert variant="warning">
    <AlertTriangle />
    <AlertDescription>
      This puzzle has {explanations.length} explanations, but none are eligible for discussion.
      Eligible explanations must be:
      <ul className="list-disc list-inside mt-2">
        <li>Less than 30 days old</li>
        <li>From reasoning models (GPT-5, o-series, Grok-4)</li>
        <li>Successfully saved with provider response ID</li>
      </ul>
    </AlertDescription>
  </Alert>
)}
```

---

### Phase 5: Reduce Explanatory Text in ExplanationsList

**Remove lines 111-147 from ExplanationsList.tsx**

Replace with minimal 1-alert version:

```typescript
{pageContext === 'discussion' && (
  <Alert className="mb-4 bg-purple-50 border-purple-300">
    <Brain className="h-4 w-4 text-purple-600" />
    <AlertDescription className="text-sm text-purple-900">
      Selected analysis will be refined through progressive reasoning with full server-side memory (30-day retention).
      {hasNonReasoningModels && (
        <strong className="block mt-1">⚠️ Some models may not support reasoning persistence.</strong>
      )}
    </AlertDescription>
  </Alert>
)}
```

---

## Files to Modify

### Backend
- ✅ **NEW:** `server/controllers/discussionController.ts`
- ✅ `server/routes.ts` - Add discussion routes

### Frontend
- ✅ `client/src/pages/PuzzleDiscussion.tsx` - Complete redesign
- ✅ `client/src/components/puzzle/AnalysisResultListCard.tsx` - Add `buttonText` prop
- ✅ `client/src/components/puzzle/debate/ExplanationsList.tsx` - Reduce text, pass button text
- ✅ `client/src/components/puzzle/debate/PuzzleDebateHeader.tsx` - Fix placeholder text
- ✅ **NEW:** `client/src/hooks/useEligibleExplanations.ts`

### Types
- ✅ `client/src/types/puzzle.ts` - Add eligible explanation types

---

## Success Criteria

✅ Landing page shows search box and recent eligible table  
✅ No walls of explanatory text  
✅ Puzzle page only shows eligible explanations  
✅ All "Start Debate" text replaced with context-appropriate text  
✅ Clear warning when no eligible explanations exist  
✅ Backend API returns only eligible explanations  
✅ Filtering works on both client and server side  

---

## Implementation Order

1. **Backend API** (discussionController + routes)
2. **Frontend hook** (useEligibleExplanations)
3. **Component fixes** (button text props)
4. **Page redesign** (PuzzleDiscussion landing + puzzle view)
5. **Text reduction** (ExplanationsList alerts)
6. **Testing** (verify filtering works, UI text correct)
