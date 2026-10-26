# ARC-2 capped-output terminal
Author: GPT-6.1 Sol / Codex
Date: 26-October-2026

## Approved scope
The Boss requests a denser financial-terminal-style treatment of `/arc2/capped`. Replace the long card gallery with a compact watchlist and focused grid inspector. Preserve the exact 22-output/20-task cohort, API-backed grids, source qualification, zero-based indices, and existing task/explanation links.

## Design and reuse
Charcoal workspace, square borders, amber headings, cyan links, monospace identifiers and dimensions. A sortable/searchable output watchlist shows task ID, test index, dimensions and output-cell count. Selecting a row reveals paired grids and immediately visible compact training examples; remaining tests stay expandable. Reuse TanStack Query's existing puzzle keys and API, GridDisplay, shadcn controls, and page metadata. Desktop split-pane; mobile stacked selector and inspector. No backend or solver changes.

## Checklist
- [x] Read repository guidance and inspect current gallery, data hooks and grid renderer.
- [x] Implement and update changelog.
- [x] Production build; verify real cohort, desktop/mobile layout, search/sort/selection and links.
- [x] Scoped push through existing deployment, live verification.

## Verification evidence
Production build passed. All 22 references across 20 tasks validated against evaluation2 dataset files. Browser checks passed on measured 1440px desktop and 375px mobile CSS viewports: all API data loaded, search returns both 88bcf3b4 indices, cell sort descends 900→25, selection and next-output controls update grids, other-test disclosure opens/closes, highlighted explanation retained. No application console errors; mobile grid bounds stay within document width. TypeScript reports existing unrelated SnakeBench/ingest/test failures, none in the modified page. Screenshots: `/Volumes/Samsung 9100 SSD/data/arc2-terminal-desktop.png`, `arc2-terminal-mobile.png`. Preview tool unavailable, so used a temporary Vite configuration proxying real live read-only puzzle APIs; remove it and stop server after delivery.

Live deployment `72f4242b-f8d6-4533-b272-ac6b6937f22c` succeeded for implementation commit `b7c2e02b`. Browser verification on the public URL confirms the terminal, all 22 output rows, working search and selected-grid updates, preserved task/highlight links, no application errors and usable 1440px/375px layouts. Live screenshots: `/Volumes/Samsung 9100 SSD/data/arc2-terminal-live.png` and `arc2-terminal-live-mobile.png`. Temporary preview config removed and preview process stopped. Shared main checkout left untouched.
