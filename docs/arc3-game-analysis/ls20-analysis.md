# Game LS20 (Locksmith) - Frame Analysis

**Source:** Initial frame-by-frame analysis of LS20 gameplay

---

## Initial Frame Analysis

- **Grid size:** 64×64
- **Win score:** 8
- **Main color distribution:**
  - 4 (gray): Background (52%)
  - 3 (green): Main play area (42.6%)
  - 0 (black): Small regions (1.6%)
  - 5 (yellow): Small squares (1.1%)
  - 9 (red): Small blocks (1.6%)
  - 12 (purple): 8-pixel stripes
  - 15 (pink): Top pattern row
  - 8 (blue): Small 2×2 blocks in upper right

---

## Key Patterns

1. **Top row pattern (row 2):** Alternating 15 and 4 values
2. **Large green region:** Rows 8–47, columns 8–47 (main play area)
3. **Objects in play area:**
   - Yellow (5) blocks
   - Red (9) pairs
   - Black (0) regions of varying sizes
   - Purple (12) horizontal stripes

---

## Action Results

### Action 1: RIGHT (ACTION4, type 2)

- **Result:** No changes detected
- **Hypothesis:** RIGHT movement doesn't affect any grid objects

### Action 2: LEFT (ACTION3, type 1)

- **Result:** 129 pixels changed
- **Observed changes:**
  1. Position (2,2): 15 → 3 (pink became green)
  2. Region (40–47, 40–47): 3 → 12 (green became purple)
  3. Region (48–55, 40–47): 12 → 3 (purple became green)

- **Hypothesis:** LEFT movement causes block swapping—purple and green blocks exchange positions

### Action 3: UP (ACTION1, type 3)

- **Result:** TBD (pending analysis)

---

## Working Theory

The game appears to involve:
- Moving or swapping colored blocks within the play area
- LEFT action causes swaps between purple (12) and green (3) blocks
- Goal: Arrange blocks in a specific pattern to reach win score of 8
- Key mechanics likely involve rotator tiles transforming the key shape

---

## Next Steps for Analysis

1. Analyze UP action results
2. Test DOWN action
3. Map pattern in how blocks move/swap
4. Try SPACE (ACTION5) to see if it has special behavior
5. Map out all moveable objects and their behaviors
6. Determine door location and key shape requirements

