# 2026-01-31 ARC3 Studio UI Pass Plan (Status)

## Purpose

Deliver a UI-only refresh for the ARC3 Studio community experience (landing + upload), using the official ARC3 palette exclusively and removing hard-coded editorial metadata from the UI. This work is about ARC-AGI-3 / ARC Prize; avoid outdated ARC3 preview assumptions and do not invent game difficulty/level progression in the UI.

This document is the current status snapshot: what is done, what is not done, and what remains.

## Scope

- Frontend only (React / Vite / TS).
- Apply a pixel/sprite-inspired look using the ARC3 palette from `client/src/utils/arc3Colors.ts`.
- Improve legibility and fix incorrect external links.
- Remove hard-coded or editorial UI fields (difficulty, levels, game-over UX copy) where they do not come from the Python backend.

## Completed

### Core UI building block

- Added shared ARC3 “pixel UI” primitives and palette-locked theme vars:
  - `client/src/components/arc3-community/Arc3PixelUI.tsx`
  - Provides `Arc3PixelPage`, `PixelPanel`, `PixelButton`, and a deterministic `SpriteMosaic` for a 2D sprite-sheet feel.
  - All colors are sourced from `client/src/utils/arc3Colors.ts` (no Tailwind color utilities in these components).

### ARC3 landing page (/arc3)

- Replaced the previous zinc/emerald landing page with a palette-locked “ARC3 Studio” landing page:
  - `client/src/pages/arc3-community/CommunityLanding.tsx`
- Fixed incorrect ARCEngine repository link:
  - Updated to `https://github.com/arcprize/ARCEngine`.
- Added a clear, Python-developer-oriented “Submitting your ARCEngine game” explainer section on the landing page.
- Removed hard-coded editorial metadata from the landing UI:
  - No “difficulty” column.
  - No “levels” column.

### Upload page (/arc3/upload)

- Replaced previous slate/purple upload styling with palette-locked ARC3 pixel UI:
  - `client/src/pages/arc3-community/GameUploadPage.tsx`
- Removed the “difficulty” field from the upload UI (do not ask users for it; do not invent it).
- Added clearer “what you submit / what happens next” explanation for Python developers.
- Kept existing validation and ID uniqueness checks (backend-driven), but improved presentation and legibility.
- Fixed ARCEngine repository link:
  - Updated to `https://github.com/arcprize/ARCEngine`.

## Not Completed (Work Started, Not Finished)

### Gallery page (/arc3/gallery)

- `client/src/pages/arc3-community/CommunityGallery.tsx` still uses the older terminal/zinc theme and exposes difficulty filtering UI.
- This page still needs:
  - Palette-locked styling to match the new ARC3 Studio look, and
  - Removal of difficulty UI (filtering and display) if the product requirement is “no difficulty shown in the UI”.

### Game play page (/arc3/play/:gameId)

- `client/src/pages/arc3-community/CommunityGamePlay.tsx` currently has TypeScript errors due to a partial refactor:
  - References to `setIsGameOver`, `setIsWin`, and `isGameOver` exist, but the corresponding state variables were removed.
- This page still needs:
  - A clean compile fix by removing these references (or reintroducing state only if it is strictly backend-driven and required for UX).
  - Consistency with the ARC3 palette UI pass (optional, but part of the overall “looks like shit” complaint).

## Remaining TODOs

1. Fix TypeScript build errors in `client/src/pages/arc3-community/CommunityGamePlay.tsx` by removing dead references to game-over state setters/flags.
2. Apply the ARC3 palette-locked pixel UI to `client/src/pages/arc3-community/CommunityGallery.tsx` and remove difficulty-related UI (filter + display) if required.
3. Optional: Apply the same UI pass to `client/src/pages/arc3-community/GameCreationDocs.tsx` for visual consistency (currently uses slate colors).
4. Run `npm run test` and `npm run build` to confirm the UI compiles and routes load.
5. Update `CHANGELOG.md` with a new top entry describing the ARC3 UI pass (what/why/how).

## Known Issues

- `client/src/pages/arc3-community/CommunityGamePlay.tsx` has unresolved TypeScript errors (missing identifiers).
- `client/src/pages/arc3-community/CommunityGallery.tsx` still contains difficulty-related UI and old color theme.

## Files Added / Replaced (This UI Pass)

- `client/src/components/arc3-community/Arc3PixelUI.tsx`
- `client/src/pages/arc3-community/CommunityLanding.tsx`
- `client/src/pages/arc3-community/GameUploadPage.tsx`

