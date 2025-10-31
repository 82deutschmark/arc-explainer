# Solver Actions – Design Fix Guide (31 Oct)

Author: OpenAI Codex Agent
Date: 2025-10-31

PURPOSE: Provide clear, actionable guidance for fixing the visual design and UX of the solver actions on ARC Explainer pages (e.g., Puzzle Examiner). This is not a marketing CTA redesign; it’s about usable, consistent, developer-friendly controls aligned with DaisyUI and our app’s patterns.

SRP/DRY check: Pass — scoped to solver action controls only; reuses DaisyUI tokens/components.

---

## Problem Summary

- Solver buttons (e.g., “Saturn Solver”, “Grover Solver”, “Show Emojis”) read as mismatched pills floating in the header area.
- Visual hierarchy is unclear; buttons compete without context or state.
- Inconsistent color semantics and icon styles; unclear affordances (toggle vs action).
- No quick metadata (speed/cost/accuracy hints), no disabled/busy states, and no responsive layout rules.

## Goals

- Make solver actions obvious, consistent, and compact.
- Separate toggles (view settings) from actions (run solver).
- Provide at‑a‑glance context (model, speed, cost) without clutter.
- Follow Shadcn components and theme tokens. No custom look if a Shadcn variant exists.

## UI Structure (Recommended)

- Left: Title and puzzle summary.
- Right: `SolverToolbar` cluster with two groups:
  - View Toggles group (e.g., Emoji mode): compact icon+label switches.
  - Solver Actions group: primary/secondary buttons with attached metadata.

## Components

1) View toggle (emoji)
- Use shadcn `toggle` or `btn btn-sm btn-ghost` with `aria-pressed` and clear label: “Emojis”.
- Persist state; reflect on/off visually and via `title`.

2) Solver action button
- Base: `btn btn-primary` for the recommended/default model; `btn btn-secondary` for alternatives.
- Include small sublabel beneath the main label using a `btn` with flex-column or an inline badge.
- States: default, hover, disabled, loading (spinner), and success (brief check icon).
- Tooltip: brief description (speed/cost tradeoff). Use DaisyUI `tooltip`.

3) Solver metadata badge
- Small neutral badge (e.g., `badge badge-ghost`) with 1–2 key indicators: `Fast`, `$$`, `Accurate`.
- Keep to max two tokens to avoid noise.

## Content Rules

- Names: prefer model names users see elsewhere (e.g., “Saturn”, “Grover”).
- Labels: action‑led, e.g., “Run Saturn”, “Run Grover”.
- Tooltips: one‑line, plain language: “Balanced accuracy/cost. ~8–12s.”
- Do not introduce marketing adjectives; keep it factual.

## Responsive Behavior

- ≥1024px: show icon + label + badge.
- 640–1023px: show icon + short label; hide secondary metadata badge.
- <640px: stack into a 2‑row toolbar: row 1 = view toggles, row 2 = solver buttons (full‑width `btn btn-sm`).

## States & Accessibility

- Keyboard reachable in logical order: toggles first, then actions.
- `aria-pressed` for toggles; `aria-busy` while running; disable other solver buttons while one is running.
- Provide `title` on buttons; ensure text alternatives for icons.
- Color contrast: meet WCAG 2.1 AA for text and icons.

## Implementation Notes

- Prefer composing an isolated `SolverToolbar.tsx` used by `PuzzleHeader.tsx`.
- Reuse existing `ModelButton.tsx` if present; refactor to accept:
  - `variant: 'primary' | 'secondary'`
  - `state: 'idle' | 'loading' | 'success' | 'disabled'`
  - `hint?: string` (tooltip)
  - `badges?: string[]` (metadata tokens)
  - `onClick: () => void`
- Extract emoji view toggle into `EmojiMosaicAccent.tsx` (stateless) + hook for persistence.

### Suggested Props for a new `SolverToolbar`

```
type SolverMeta = {
  id: string;            // 'saturn' | 'grover'
  label: string;         // 'Run Saturn'
  variant: 'primary' | 'secondary';
  badges?: string[];     // ['Fast', '$$']
  hint?: string;         // tooltip
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

type SolverToolbarProps = {
  emojiEnabled: boolean;
  onToggleEmoji: () => void;
  solvers: SolverMeta[];
};
```

### DaisyUI Classes

- Group container: `join join-horizontal gap-2`
- View toggles: `btn btn-sm btn-ghost` or `toggle toggle-sm`
- Primary solver: `btn btn-primary btn-sm`
- Secondary solver: `btn btn-secondary btn-sm`
- Loading: `btn-loading`
- Badges: `badge badge-ghost badge-sm`

## Pseudocode Layout

```
<div className="flex items-center justify-between gap-4">
  <HeaderLeft />
  <div className="flex items-center gap-3">
    <div className="join">
      <button className={toggleClass} aria-pressed={emojiEnabled} onClick={onToggleEmoji}>
        <IconEmoji />
        <span className="ml-1 hidden sm:inline">Emojis</span>
      </button>
    </div>
    <div className="join">
      {solvers.map(s => (
        <button key={s.id} className={btnClass(s)} disabled={s.disabled} aria-busy={s.loading} title={s.hint} onClick={s.onClick}>
          <IconByModel id={s.id} />
          <span className="ml-1">{s.label}</span>
          {s.badges?.length ? (
            <span className="ml-2 hidden lg:inline-flex gap-1">
              {s.badges.map(b => <span key={b} className="badge badge-ghost badge-sm">{b}</span>)}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  </div>
```

## Integration Steps

1) Create `client/src/components/puzzle/SolverToolbar.tsx` per props above.
2) Refactor `ModelButton.tsx` to support `variant`, `state`, `hint`, and `badges`.
3) Move existing solver triggers from `PuzzleHeader.tsx` into `SolverToolbar` and wire callbacks.
4) Replace ad‑hoc emoji “Show Emojis” button with a proper toggle; keep logic in `EmojiMosaicAccent.tsx` and a small hook (persist to localStorage or app state if already present).
5) Ensure loading/disabled states when a solver is running; surface a toast and inline status.

## Copy Examples

- Saturn: label “Run Saturn”, hint “Balanced accuracy and cost. ~8–12s.” badges `["Balanced", "$$"]`
- Grover: label “Run Grover”, hint “Faster, slightly higher cost. ~5–8s.” badges `["Fast", "$$$"]`

## Acceptance Criteria

- Visual consistency with Shadcn; no custom bespoke CSS beyond utility classes.
- Clear separation: toggles vs actions; correct ARIA and focus order.
- Loading/disabled states function during solver execution.
- Responsive layout behaves per rules above; no wrap-overlap at common breakpoints.
- Zero regressions to solver invocation logic.

## Out of Scope (for this pass)

- Changing solver algorithms or backend behavior.
- Rewriting page header layout beyond placing the toolbar.

---

Notes for reviewers: Keep changes minimal and compositional. Prefer refactoring existing components over introducing new styling systems. If DaisyUI tokens aren’t available, align with existing theme colors.

