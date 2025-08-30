---
# Grid Rendering Guide for AnalysisResultCard
---

This document explains **how grids are drawn** in `AnalysisResultCard.tsx` so that you, as a junior developer, can replicate or extend the behaviour elsewhere in the codebase.

## 1. Key React Components

* **`PuzzleGrid`** – Renders a complete grid (2-D array of numbers).
* **`GridCell`** – Renders a single cell inside a grid.

These live in:
- `client/src/components/puzzle/PuzzleGrid.tsx`
- `client/src/components/puzzle/GridCell.tsx`

`AnalysisResultCard` never draws individual squares itself – it delegates all drawing to `PuzzleGrid`, passing the puzzle data and visual options.

## 2. Data Flow

1. `AnalysisResultCard` receives **predicted** and **expected** 2-D number arrays from the backend.
2. It decides which grid(s) to show (single-test vs multi-test).
3. For each grid it renders:
   ```tsx
   <PuzzleGrid grid={predGrid}
               title="Predicted Answer"
               showEmojis={false}
               diffMask={diffMask}/>
   ```
4. The optional `diffMask` is a boolean 2-D array highlighting mismatching cells.

## 3. `PuzzleGrid` props

| Prop            | Type                | Purpose |
|-----------------|---------------------|---------|
| `grid`          | `number[][]`        | Raw pixel values (0-9) |
| `title`         | `string`            | Grid caption |
| `showEmojis`    | `boolean`           | If `true` each pixel is rendered with an emoji palette (see `spaceEmojis.ts`) instead of a coloured square |
| `highlight`     | `boolean`           | Adds green border/background to emphasise the _correct_ grid |
| `emojiSet`      | `Record<number,string>` | Optional custom palette |
| `diffMask`      | `boolean[][]`       | When supplied, cells whose mask value is `true` get a red border (implemented in `GridCell`) |

## 4. Responsive Sizing Logic

`PuzzleGrid` chooses **cell size** (large / normal / small) based on the larger of rows/columns:
```ts
const maxDim = Math.max(rows, cols);
const size = maxDim <= 5 ? 'large' : maxDim <= 10 ? 'normal' : 'small';
```
`GridCell` translates the `size` string into Tailwind utility classes so that the entire grid fits neatly in its card.

## 5. Colour / Emoji Rendering (`GridCell`)

```tsx
const colorMap: Record<number,string> = {
  0: 'bg-gray-200',
  1: 'bg-blue-500',
  // ...
};

return showEmojis ? <span>{emojiSet[value]}</span>
                  : <div className={colorMap[value]} />
```

When `diffMask` is `true` for that coordinate, an extra `ring-red-500` class is added to draw an error outline.

## 6. Adding a New Grid Elsewhere

1. **Import the component**:
   ```tsx
   import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
   ```
2. **Prepare your data** – you need a 2-D array of integers 0-9.
3. **Render**:
   ```tsx
   <PuzzleGrid grid={myGrid} title="My New Grid" showEmojis />
   ```
4. (Optional) Provide a `diffMask` or `highlight` flag as needed.

## 7. Common Pitfalls

* Ensure each row inside `grid` has the **same length**; otherwise React will complain and the CSS grid will misalign.
* `diffMask` must match the exact dimensions of `grid`.
* Avoid generating new array references in every render; memoise heavy calculations (`useMemo`) as shown in `PuzzleGrid`.

## 8. Where to Extend

* **Custom palettes** – Pass a bespoke `emojiSet` to support themed emojis.
* **Animation** – Wrap `GridCell` content in a motion component if you want transitions.
* **Additional overlays** – Extend `GridCell` to draw icons (e.g., ✖) when a cell is incorrect.

---

Happy coding! If anything is unclear, update this doc as you learn.
