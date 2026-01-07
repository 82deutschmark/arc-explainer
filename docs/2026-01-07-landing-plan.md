# Plan: Landing “Choose Your Path” Hero
**Date:** 2026-01-07  
**Author:** Cascade (OpenAI o4-preview)  
**Context:** Replace the current rotating ARC GIF hero with a split hero that spotlights ARC 1&2 puzzles on the left and a live-feeling ARC-3 replay miniature on the right.

---

## 1. Inputs & References
1. Existing landing implementation in `client/src/pages/LandingPage.tsx` (rotating GIF hero).
2. ARC 1&2 GIF library under `client/public/images/decoration/`.
3. ARC-3 replay JSONL samples plus guidance in:
   - `docs/2026-01-03-arc3-agent-plan.md`
   - `docs/2026-01-03-arc3-python-preprocessing-guide.md`
4. Streaming + replay precedent from Worm Arena live components (`client/src/pages/WormArenaLive.tsx`) for layout rhythm and timer treatments.
5. CHANGELOG + Doc standards in `AGENTS.md`.

---

## 2. Vision & UX Notes
1. Hero headline: “Choose your path” with subcopy explaining ARC 1&2 exploration vs ARC-3 live challenge.
2. **Left slice (ARC 1&2 Explorer)**  
   - Static panel that showcases one curated GIF (rotate every ~12s) with CTA buttons for “Browse ARC 1&2 puzzles” and “Watch walkthrough”.
   - Secondary text summarizing dataset scale, solver counts, and link to analytics.
3. **Right slice (ARC 3 Live Replay)**  
   - Embed a looping MP4 (converted from ARC-3 JSONL) in a 4:3 frame with play/pause + timestamp overlay to evoke replay controls.
   - Provide CTA for “Launch ARC-3 Arena” (routes to `/arc3/arena` per DEV_ROUTES) and a smaller “See agent plan” link.
4. Maintain accessible typography (no AI-slop), with tailored background gradient (deep charcoal to midnight blue) and subtle scanline/mesh texture.

---

## 3. Functional Requirements
1. **Asset discovery**  
   - Enumerate available ARC 1&2 GIFs; select 3–4 thematically diverse options.  
   - Locate ARC-3 JSONL files (likely under `data/arc3-samples/` or external references). Confirm license + size.
2. **ARC-3 replay generation**  
   - Build a one-off conversion script (`scripts/arc3-jsonl-to-mp4.ts` or Python) that reads frame states and renders them into PNG frames (use Pillow or canvas) before ffmpeg-ing to MP4/WebM.  
   - Store generated clip in `client/public/videos/arc3/choose-your-path.mp4` and document pipeline in `docs/reference/frontend/`.
3. **Frontend refactor**  
   - Update `LandingPage.tsx` with new hero structure: responsive CSS grid (stacked on mobile).  
   - Left slice uses existing GIF array + local state for rotation.  
   - Right slice loads MP4 via `<video>` with poster fallback; include overlay metadata (task ID, duration).  
   - Add CTA buttons reusing shared button styles (`client/src/components/ui/button.tsx`).  
   - Ensure file header metadata updated per AGENT rules.
4. **Performance & accessibility**  
   - Lazy-load MP4, provide reduced-motion guard (pause autoplay when `prefers-reduced-motion`).  
   - Alt text + captions for video; ensure colors meet contrast requirements.  
   - Prefetch first ARC task route for snappy navigation.
5. **Changelog & Docs**  
   - Document behavior change at top of `CHANGELOG.md` (SemVer bump).  
   - Append conversion steps + asset inventory to `docs/reference/frontend/landing-hero.md` (create if missing).

---

## 4. Implementation Steps
1. **Recon & asset audit (0.5d)**  
   - grep repo for ARC 3 samples, confirm format, and list GIFs.  
   - Validate existing landing dependencies + CSS constraints.
2. **Replay conversion pipeline (0.5–1d)**  
   - Prototype script locally, verify output quality, and store reproducible command in docs.  
   - Commit generated MP4 if size acceptable (<5 MB); otherwise host via CDN bucket and reference env var.
3. **Frontend hero redesign (1d)**  
   - Create new `HeroSlice` component for SRP, plug into Landing.  
   - Implement responsive grid, CTA wiring, and state logic.  
   - Add unit snapshot (if feasible) or Storybook entry.
4. **Polish + QA (0.5d)**  
   - Cross-browser check (Chrome, Firefox).  
   - Test reduced-motion, mobile stacking, link targets, and load times.  
   - Update docs + changelog.

---

## 5. Risks & Mitigations
1. **Large MP4 assets** – keep clip short (5–7 s) and compress via ffmpeg (`-crf 28`). Consider WebM fallback.  
2. **ARC-3 data availability** – if no local JSONL, request dataset before implementation; note dependency in doc.  
3. **Accessibility regressions** – run Lighthouse/axe checks before shipping.  
4. **Animation overload** – respect reduced-motion setting; pause both GIF rotation and video autoplay when necessary.

---

## 6. Success Criteria
1. Landing page clearly communicates ARC 1&2 vs ARC-3 paths within first viewport.  
2. ARC-3 replay miniature loops smoothly without blocking main thread.  
3. Buttons route to existing experiences with no new pages required.  
4. All changes documented (plan, conversion instructions, changelog) and pass lint/test suites.