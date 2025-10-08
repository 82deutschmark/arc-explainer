# CompactPuzzleDisplay - Robust Scalable Layout Plan

**Date:** 2025-10-08
**Goal:** Fix CompactPuzzleDisplay to handle 1, 2, or 3+ test cases elegantly with NO hardcoded assumptions

---

## Current Problems

### 1. Badge Placement Disaster
**Current code (lines 121-125):**
```typescript
{isMultiTest && (
  <Badge variant="outline" className="text-[9px] px-1 py-0">
    Test {index + 1}
  </Badge>
)}
```
**Problem:** Badge appears INLINE with grids, floating in the middle of the row!

### 2. Hardcoded Grid Sizes
**Current code (lines 128, 135):**
```typescript
<div className="w-32 h-32 border border-white/40 p-1 bg-gray-900/5">
```
**Problem:** Fixed 32x32 (128px) doesn't adapt to:
- Large grids (20x30) - too small
- Small grids (3x3) - too large
- Multi-test layouts - needs to shrink

### 3. Horizontal-Only Layout
**Current code (line 118):**
```typescript
<div className="flex flex-wrap items-center gap-12 min-w-fit">
```
**Problem:** With 3 tests = 6 grids × 128px = ~1150px minimum width!
- Forces horizontal scrolling
- Doesn't stack vertically when needed
- No adaptation for screen size

### 4. No Layout Adaptation
**Problem:** Same layout for all cases:
- 1 test: Wastes space (could be larger)
- 2 tests: OK horizontally
- 3+ tests: Breaks layout (too wide)

---

## Robust Solution - Adaptive Layout

### Principle: Let Content and Count Determine Layout

**Strategy:**
1. **Badge ABOVE row** - not inline
2. **Dynamic grid sizing** - based on content and test count
3. **Adaptive layout** - horizontal for 1-2 tests, vertical for 3+ tests
4. **Responsive container** - proper flex/grid usage

### Layout Patterns

#### Single Test (1 test case):
```
Test Input → Output
[larger grid, maybe 48x48 or 64x64]
```
No badge needed, plenty of space.

#### Dual Test (2 test cases):
```
Test 1: [Input] → [Output]    Test 2: [Input] → [Output]
```
Horizontal layout, medium grids (32x32 or 40x40).

#### Multi-Test (3+ test cases):
```
Test 1
  [Input] → [Output]
Test 2
  [Input] → [Output]
Test 3
  [Input] → [Output]
```
Vertical stack, compact grids (24x24 or 28x28).

---

## Implementation Plan

### Step 1: Restructure Test Case Container

**Remove inline badge, add proper structure:**

```typescript
{/* Test Cases - ADAPTIVE LAYOUT */}
<div className={`flex ${testCases.length > 2 ? 'flex-col' : 'flex-row flex-wrap'} gap-4`}>
  {testCases.map((testCase, index) => (
    <div key={index} className="flex flex-col gap-1">
      {/* Badge ABOVE row if multi-test */}
      {isMultiTest && (
        <span className="text-[9px] text-gray-500 font-medium">
          Test {index + 1}
        </span>
      )}

      {/* Grid row */}
      <div className="flex items-center gap-4">
        <div>
          <div className="text-[9px] text-gray-600 mb-1">Input</div>
          <div className={gridSizeClass}>
            <TinyGrid grid={testCase.input} />
          </div>
        </div>
        <div className="text-xs text-gray-400">→</div>
        <div>
          <div className="text-[9px] text-gray-600 mb-1">Output</div>
          <div className={gridSizeClass}>
            <TinyGrid grid={testCase.output} />
          </div>
        </div>
      </div>
    </div>
  ))}
</div>
```

### Step 2: Dynamic Grid Sizing

**Calculate size based on test count:**

```typescript
// Adaptive grid sizing based on test count
const getGridSizeClass = (testCount: number): string => {
  if (testCount === 1) {
    return 'w-48 h-48'; // Large (192px) - single test has space
  } else if (testCount === 2) {
    return 'w-32 h-32'; // Medium (128px) - dual test horizontal
  } else {
    return 'w-24 h-24'; // Small (96px) - multi-test vertical stack
  }
};

const gridSizeClass = getGridSizeClass(testCases.length);
```

### Step 3: Adaptive Container Layout

**Use conditional flex direction:**

```typescript
// Container adapts to test count
const containerClass = testCases.length > 2
  ? 'flex flex-col gap-3'       // Vertical for 3+ tests
  : 'flex flex-row flex-wrap gap-8'; // Horizontal for 1-2 tests
```

### Step 4: Remove Hardcoded Gaps

**Current:** `gap-12` (48px) - way too much!
**Better:** `gap-4` (16px) for vertical, `gap-8` (32px) for horizontal

---

## Complete Refactored Code

```typescript
export const CompactPuzzleDisplay: React.FC<CompactPuzzleDisplayProps> = ({
  trainExamples,
  testCases,
  // ... other props
}) => {
  const isMultiTest = testCases.length > 1;

  // Adaptive sizing
  const getGridSizeClass = (testCount: number): string => {
    if (testCount === 1) return 'w-48 h-48';       // 192px - single test
    else if (testCount === 2) return 'w-32 h-32';  // 128px - dual test
    else return 'w-24 h-24';                       // 96px - 3+ tests
  };

  const gridSizeClass = getGridSizeClass(testCases.length);

  // Adaptive layout direction
  const containerClass = testCases.length > 2
    ? 'flex flex-col gap-3'          // Vertical stack for 3+ tests
    : 'flex flex-row flex-wrap gap-8'; // Horizontal for 1-2 tests

  return (
    <Card className="p-0">
      {/* ... existing header/training ... */}

      {/* Test Cases - ADAPTIVE */}
      <div className={containerClass}>
        {testCases.map((testCase, index) => (
          <div key={index} className="flex flex-col gap-1 min-w-fit">
            {/* Label above row */}
            {isMultiTest && (
              <span className="text-[9px] text-gray-500 font-medium">
                Test {index + 1}
              </span>
            )}

            {/* Input → Output row */}
            <div className="flex items-center gap-4">
              <div>
                <div className="text-[9px] text-gray-600 mb-1">Input</div>
                <div className={`${gridSizeClass} border border-white/40 p-1 bg-gray-900/5`}>
                  <TinyGrid grid={testCase.input} />
                </div>
              </div>

              <div className="text-xs text-gray-400">→</div>

              <div>
                <div className="text-[9px] text-gray-600 mb-1">Output</div>
                <div className={`${gridSizeClass} border border-white/40 p-1 bg-gray-900/5`}>
                  <TinyGrid grid={testCase.output} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
```

---

## Benefits

✅ **Adaptive Layout**
- 1 test: Large grids, horizontal
- 2 tests: Medium grids, horizontal
- 3+ tests: Small grids, vertical stack

✅ **Proper Badge Placement**
- Badge ABOVE row, not inline
- Only shows for multi-test puzzles

✅ **No Hardcoded Assumptions**
- Grid size adapts to test count
- Layout direction adapts to test count
- Gaps scale appropriately

✅ **Scalable**
- Works for 1-10+ tests
- Automatically stacks vertically when needed
- No horizontal scroll issues

✅ **Clean Structure**
- Semantic HTML structure
- Proper flexbox usage
- Clear visual hierarchy

---

## Testing

1. **Single test puzzle** (most common):
   - Should show large grids (192px)
   - Horizontal layout
   - No "Test 1" label

2. **Dual test puzzle**:
   - Should show medium grids (128px)
   - Horizontal layout side-by-side
   - "Test 1" and "Test 2" labels above rows

3. **Triple test puzzle (1ae2feb7)**:
   - Should show small grids (96px)
   - Vertical stack layout
   - "Test 1", "Test 2", "Test 3" labels above rows
   - No horizontal overflow

4. **Responsive behavior**:
   - Should adapt to container width
   - Should not force horizontal scrolling
   - Should maintain aspect ratios

---

## Files to Modify

1. ✏️ **CompactPuzzleDisplay.tsx**
   - Add `getGridSizeClass()` function
   - Add adaptive container class logic
   - Restructure test case mapping
   - Move badge above row
   - Remove hardcoded `w-32 h-32`
   - Adjust gaps (`gap-12` → `gap-4`/`gap-8`)
