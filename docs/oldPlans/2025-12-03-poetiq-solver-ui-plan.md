## Goal
Streamline the Poetiq Solver UI so only actionable, real-time data is surfaced. Remove static "Experts/Best Result/Runtime" cards, reposition total token usage, and make the agent runtime panel show only the model + usage summary inline with the dashboard header.

## Tasks
1. **Audit current layout** — Inspect `client/src/pages/PoetiqSolver.tsx`, `client/src/components/poetiq/PoetiqLiveDashboard.tsx`, and `client/src/components/poetiq/PoetiqAgentsRuntimePanel.tsx` to confirm where the dead cards render and which state fields power the metrics we want to keep (model label, token counts, totals, live log stream).
2. **Redesign dashboard cards** — Update `PoetiqLiveDashboard` to:
   - Collapse the status + usage info into a single dense header that shows model name, tokens in/out/total, and elapsed time.
   - Replace the “Experts” and “Best Result” cards with one skinny live iteration ticker + event list so the screen is not wasted on static placeholders.
   - Keep the generated code/log stream blocks but tighten paddings and make sure they flex next to each other on large screens.
3. **Trim Agents runtime panel** — Refactor `PoetiqAgentsRuntimePanel` to only render the compact header with model + token usage (since the rest is noise per user), and ensure the panel can optionally embed inside the dashboard header for consistency.
4. **Integrate on main page** — Adjust `PoetiqSolver.tsx` layout if needed so the refreshed dashboard sits at the top with the summarized metrics visible before controls/terminal sections.
5. **Documentation + changelog** — Update `CHANGELOG.md` with the semantic version bump and brief bullets for each modified file noting Codex as author.

## Validation
- Run `npm run lint -- PoetiqLiveDashboard.tsx` if available (or at minimum `tsc --noEmit`) to ensure JSX/TS checks pass.
- Manually reload Poetiq Solver page and validate that only the new header + slim log/code cards appear while a run is in progress, with model/tokens always visible.
