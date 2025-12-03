# 2025-12-02 – Shadcn/ui Replatforming Plan

**Author:** Codex / GPT-5  
**Purpose:** Replace the lingering DaisyUI surface area with the project-standard shadcn/ui primitives, so every page/component shares the same accessible Radix-based foundation. This plan focuses on practical migration sequencing, incremental safety rails, and final removal of DaisyUI from Tailwind + package dependencies.

---

## 1. Objectives

1. **Consistency:** Ensure every shared component (cards, buttons, badges, dialogs, accordions, tables) comes from `client/src/components/ui`.
2. **Accessibility:** Leverage Radix (shadcn/ui) primitives for keyboard navigation and ARIA compliance (modals, tooltips, menus).
3. **Maintainability:** Eliminate dual design systems so future UI work references a single set of tokens/utilities.
4. **Performance:** Remove DaisyUI plugin/theme overhead from Tailwind build once conversion is complete.

---

## 2. Current State & Audit Summary

- DaisyUI still injects classes such as `btn`, `badge`, `card`, `collapse`, and `alert` across legacy puzzle components (`AnalysisResult*`, refinement UIs, Poetiq UI, etc.).
- Tailwind config (`tailwind.config.ts`) still requires `daisyui` and loads its theme tokens.
- `package.json` keeps `daisyui` dependency and the plugin is bundled for every build.
- The UI library already contains 40+ shadcn components (`client/src/components/ui`), so the tooling is ready—we only need to re-use them.

---

## 3. Migration Strategy

### Phase 1 – Foundation & Design Tokens
1. **Audit tokens:** Confirm Tailwind theme tokens cover both Daisy palette names and shadcn CSS variables. Introduce missing CSS variables now (if any) so migrations don’t block on color decisions.
2. **Utility helpers:** Add shared helpers for status colors (success/warn/error/neutral) to avoid per-file ad-hoc classes after conversion.
3. **Global styles:** Document shadcn color usage & spacing in `docs/STYLE_GUIDE.md` (new section) for future contributions.

### Phase 2 – Shared Component Families
1. **Analysis Result Suite:** `AnalysisResultCard`, `Header`, `Content`, `Grid`, `Metrics`, `Actions` — migrate to shadcn `<Card>`, `<Badge>`, `<Button>`, `<Accordion>`, `<Separator>`, `<ScrollArea>`. (HIGH impact: these cards power Puzzle Examiner, Debate, Archives.)
2. **Refinement UI:** Convert `Refinement*` components (cards, toggles) to use shadcn `<Tabs>`, `<Card>`, `<Button>`, `<Textarea>`, `<Alert>`.
3. **Poetiq Live Panels:** Align `Poetiq*` dashboards with shadcn cards/badges (mirroring Grover/Saturn).

### Phase 3 – Page-Level Pass
1. **PuzzleExaminer / PuzzleDiscussion / ModelDebate**: Remove leftover Daisy badges/buttons, rely on shared UI kit.
2. **Admin/Analytics pages:** Replace Daisy stats/alerts with shadcn equivalents.

### Phase 4 – Cleanup & Removal
1. **Remove DaisyUI plugin** from `tailwind.config.ts`.
2. **`npm uninstall daisyui`** and ensure no files import Daisy-specific CSS.
3. **Verify** via `rg "btn "` / `rg "badge "` to ensure no Daisy classes remain (allowing legitimate words only).
4. **Document** the migration in `docs/README.md` + `CHANGELOG.md` (version bump) and update CLAUDE/AGENTS instructions to mention shadcn-only policy.

---

## 4. Implementation Guidelines

1. **One family at a time:** Keep PRs/commits scoped to a coherent component cluster to ease review and regressions.
2. **Reuse UI kit:** Always import from `@/components/ui/*`; do not restyle raw Radix primitives inline.
3. **Dark-mode parity:** Use CSS variables + `class-variance-authority` variants from existing components.
4. **Testing:** Run `npm run lint` + targeted UI smoke tests (Saturn/Grover/Poetiq flows) after each major conversion.
5. **Feature toggles:** None required—visual changes should be atomic and behind existing components.

---

## 5. Immediate Next Steps

1. Convert the **Analysis Result** component cluster to shadcn/ui (establishes card/badge/button baseline).
2. Extract shared status badge helpers (success/error/warning) inside `client/src/components/ui/badge.tsx` or a dedicated `statusBadges.tsx`.
3. After verifying the cards, continue with Poetiq dashboards (reuse the same helper tokens).

Once these steps are merged, we can proceed to Phase 3 conversions and eventually remove DaisyUI completely.

---

**Sign-off:** This plan supersedes the previous DaisyUI initiative and aligns with CLAUDE/AGENTS guidance (“No custom UI when shadcn/ui provides a component”). Future UI work must rely exclusively on shadcn/ui.
