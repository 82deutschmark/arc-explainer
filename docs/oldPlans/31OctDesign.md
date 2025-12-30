# Solver Buttons – Look-Only Restyle (31 Oct)

Author: OpenAI Codex Agent
Date: 2025-10-31

PURPOSE: Minimal, “look-only” restyle for existing solver buttons (Saturn, Grover, Emoji). No structural, behavioral, or logic changes. Keep all handlers, DOM order, and component boundaries as-is. Only classes and CSS are allowed to change.

SRP/DRY check: Pass — scoped CSS skin; no new components or prop contracts.

---

## Hard Constraints

- Do not change button text, click handlers, or conditional rendering.
- Do not move buttons into new components or reorder them.
- Only add/remove classes and add one CSS file; avoid refactors.

## Target Look

- Compact “tool chip” buttons, consistent height/spacing, subtle focus ring.
- Clear hover/active states; no large shadows or gradients.
- Works on narrow widths; wraps with even gaps.

## CSS Delivery Plan

1) Create `client/src/styles/solver-buttons.css` and import once in `client/src/App.tsx`.
2) Add class hooks to the existing elements:
   - Wrapper container that already holds the three buttons → add `solver-actions`.
   - Saturn button → add `solver-btn solver-btn--primary`.
   - Grover button → add `solver-btn solver-btn--alt`.
   - Emoji button → add `solver-btn solver-btn--toggle` and bind existing active state to `aria-pressed` if available.

If there is no shared wrapper, introduce `<div className="solver-actions">` immediately around the current buttons (no logic change).

## CSS Spec (drop-in)

Place the following in `client/src/styles/solver-buttons.css`:

```
:root {
  --solver-gap: 8px;
  --solver-height: 34px;
  --solver-radius: 8px;
  --solver-font: 0.875rem; /* 14px */
  --solver-padding-x: 12px;
  --solver-icon-gap: 6px;

  /* Tune hues to match theme if needed */
  --solver-primary-bg: oklch(55% 0.2 265);
  --solver-primary-bg-hover: oklch(60% 0.2 265);
  --solver-primary-fg: #fff;

  --solver-alt-bg: oklch(55% 0.17 145);
  --solver-alt-bg-hover: oklch(60% 0.17 145);
  --solver-alt-fg: #0b1b13;

  --solver-toggle-bg: oklch(95% 0 0);
  --solver-toggle-fg: oklch(38% 0 0);
  --solver-toggle-border: oklch(86% 0 0);
  --solver-toggle-bg-active: oklch(92% 0.02 85);
}

.solver-actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--solver-gap);
  align-items: center;
}

.solver-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: var(--solver-height);
  padding: 0 var(--solver-padding-x);
  border-radius: var(--solver-radius);
  font-size: var(--solver-font);
  line-height: 1;
  border: 1px solid transparent;
  transition: background-color 120ms ease, border-color 120ms ease, transform 50ms ease;
  user-select: none;
}

.solver-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px rgb(59 130 246 / 45%);
}

.solver-btn:active {
  transform: translateY(1px);
}

.solver-btn svg, .solver-btn i { margin-right: var(--solver-icon-gap); }

/* Primary (Saturn) */
.solver-btn--primary { background: var(--solver-primary-bg); color: var(--solver-primary-fg); }
.solver-btn--primary:hover { background: var(--solver-primary-bg-hover); }

/* Alt (Grover) */
.solver-btn--alt { background: var(--solver-alt-bg); color: var(--solver-alt-fg); }
.solver-btn--alt:hover { background: var(--solver-alt-bg-hover); }

/* Toggle (Emoji) */
.solver-btn--toggle {
  background: var(--solver-toggle-bg);
  color: var(--solver-toggle-fg);
  border-color: var(--solver-toggle-border);
  border-width: 1px;
}
.solver-btn--toggle[aria-pressed="true"],
.solver-btn--toggle.is-active { background: var(--solver-toggle-bg-active); }

/* Respect existing disabled/loading classes */
.solver-btn[disabled], .solver-btn.is-loading { opacity: 0.7; cursor: not-allowed; }
```

Notes:
- If `oklch` isn’t supported in your browser target, swap to HSL/HEX equivalents.
- Keep any existing data-testid attributes intact.

## Testing Checklist

- Visual: Buttons share height/shape, tight spacing, and responsive wrap.
- Interaction: Hover/active/focus states visible; keyboard focus ring clear.
- Behavior: Clicks still invoke exactly the same handlers; no new events.
- Accessibility: Emoji button reflects state via `aria-pressed` if toggle state exists.

## Rollback

Remove the CSS import and the added class names. No logic changes to revert.

---

This doc intentionally avoids component refactors. Only skin the existing controls.
