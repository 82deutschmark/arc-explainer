# Grover Solver UI polish plan

## Goals
- Surface reasoning configuration controls by default with high-verbosity defaults.
- Reduce wasted horizontal whitespace so iteration details and Python programs are immediately visible.
- Improve program panels for easy copying and better defaults.

## Target files
- `client/src/pages/GroverSolver.tsx`
- `client/src/components/grover/IterationCard.tsx`

## Steps
1. Update Grover Solver page layout: remove constrained container widths, adjust grid column spans, and make advanced controls open with high/detailed defaults.
2. Ensure reasoning controls default to `high` effort/verbosity and detailed summaries, reflecting in start payload.
3. Enhance iteration cards: auto-expand best program, add copy-to-clipboard controls, and tweak code block styling for full visibility (no fixed max height).
4. Verify updated Tailwind classes keep responsive behavior across breakpoints.
