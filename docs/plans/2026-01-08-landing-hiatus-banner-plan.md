# 2026-01-08 Landing Hiatus Banner Plan

**Author:** Cascade (OpenAI o4-preview)
**Date:** 2026-01-08

## 1. Context
The landing page currently shows the ARC 1&2 GIF showcase and ARC3 replay grid without any operational status note. We need to surface a concise "On Hiatus – January 2026" message so visitors immediately understand that updates are paused.

## 2. Goals
1. Display the text "On Hiatus – January 2026" prominently on the landing page without disrupting the existing minimal aesthetic.
2. Ensure the message is accessible (screen reader friendly) and visually consistent across desktop and mobile.
3. Keep the implementation lightweight, reusing existing styling primitives where possible.

## 3. Non-Goals
- Reworking other landing modules (ARC3 video rotations, Worm Arena content, etc.).
- Implementing banners on other routes.

## 4. Implementation Outline
1. **Audit landing layout:** Confirm best insertion point (likely top-center overlay within `LandingPage.tsx`) and note any shared helpers required.
2. **Add hiatus text block:** Introduce a small, responsive typographic element styled in the same neon accent palette; respect reduced-motion preferences and contrast guidelines.
3. **Verify & document:** Manually test on common breakpoints, update `CHANGELOG.md` with the change rationale, and note the addition in the most relevant reference doc if needed.

## 5. Testing Checklist
- [ ] Visual check on desktop (>=1280px) and mobile (~375px).
- [ ] Confirm text remains legible against the gradient background.
- [ ] Ensure no console errors in the browser during interaction.
