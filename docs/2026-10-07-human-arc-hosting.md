# Human ARC hosting

Author: Codex — 2026-10-07. User approved this integration before implementation.

Human ARC is maintained at https://github.com/82deutschmark/human-arc and served at https://arc.markbarney.net/human-arc/.

`human-arc-source.json` pins the source commit and public PlayFab title ID. `npm run build` fetches that exact revision into ignored `external/human-arc`, installs its locked dependencies, and writes the standalone bundle to `dist/human-arc`. No PlayFab admin key is passed into the frontend build. Update the pin deliberately when releasing Human ARC changes; builds must fail if fetching or building that revision fails.

`mountHumanArc` runs before the host router and its metadata injector in both development and production. It serves assets with appropriate caching and the Human ARC index for nested application paths. Unknown assets return 404, not the host HTML. The ARC 1 & 2 navigation uses an ordinary link so the browser loads the separate app. Human ARC's own Wouter router and asset URLs use its configured base; its return link opens ARC Explainer.

Run `npm run build:human-arc` before using Human ARC from the development server. Root hosting in the Human ARC repository still works. The old GPTPlusPro deployment remains available during transition. PlayFab data stays in its existing backend; anonymous browser identity is origin-local and cannot migrate automatically across domains.

Validation: production builds, dedicated middleware routing checks, and browser assessment/puzzle navigation under the deployed prefix. See the change delivery notes for observed service limitations.

## Verified before publication

- Complete production build passed, including fetching and building the pinned Human ARC commit.
- Three HTTP middleware tests passed: redirects/query preservation/nested pages, missing assets/methods/cache, and host route isolation.
- Browser checks passed for the ARC 1 & 2 menu entry, live PlayFab assessment loading, library model-result loading, and direct puzzle refresh. Library puzzle d35bdbdc exposed an old source mismatch; Human ARC now uses the existing ARC Explainer-first lookup, as its assessment already does.
- Repository-wide TypeScript checks still report errors in untouched files (32 in Human ARC and 12 in ARC Explainer); neither reports an error in the integration files. These checks are not claimed as passing.
