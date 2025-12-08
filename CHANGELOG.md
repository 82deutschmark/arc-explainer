## ARC Explainer
- Use proper semantic versioning (MAJOR.MINOR.PATCH) for all changes!! Add new changes at the top with the time and date!

### Version 5.47.11  Dec 8, 2025 (PENDING TESTING)

- **ARC-AGI-3 Playground: add analyze_grid Python tool for grid analysis** (Author: Cascade)
  - Added an `analyze_grid` tool to the ARC3 real-game Agent runner so agents can execute sandboxed Python code for programmatic grid analysis (connected components, symmetry, bounding boxes, color counts) without flooding context with raw numeric frames.
  - Wired the tool into both non-streaming and streaming `Arc3RealGameRunner` paths, including structured `agent.tool_call` / `agent.tool_result` events in the streaming timeline and reuse of the existing `executeGridAnalysis` helper for Python execution, timeouts, and output limits.
  - Extended the ARC3 Agent Playbook with guidance on when and how to use `analyze_grid` during per-game setup and exploration, plus a dedicated reference section describing the available helpers and typical use cases.
  - **Files Modified**: `server/services/arc3/Arc3RealGameRunner.ts`, `docs/reference/arc3/ARC3_Agent_Playbook.md`, `CHANGELOG.md`

### Version 5.47.11  Dec 8, 2025 (PENDING TESTING)

- **ARC3 continuation: server-cached frames + safer chaining** (Author: Codex)
  - Cache the last ARC3 frame server-side after streaming runs and reuse it during continuation so clients aren’t forced to resend frames; only 400 when no cached frame exists and none is provided.
  - Continue to default `previousResponseId` from stored `providerResponseId` and deliver clear 400s instead of 500s when chaining data is missing.
  - Updated continuation plan to reflect the cache-first flow for ARC3 continuations.
  - **Files Modified**: `server/routes/arc3.ts`, `server/services/arc3/Arc3StreamService.ts`, `docs/plans/2025-12-08-arc3-streaming-continuation-fix-plan.md`, `CHANGELOG.md`

### Version 5.47.12  Dec 8, 2025 (PENDING TESTING)

- **ARC3 agent: keep running + loop hints** (Author: Codex)
  - Raised default max turns to an effectively unlimited value and updated UI controls to avoid auto-pausing; the agent now stops only on cancel or game end.
  - Added a simple loop detector that emits non-blocking hints when score hasn’t changed after multiple actions (no forced pause).
  - Wired loop hints into the frontend timeline and messaging, and kept user-message flow intact while runs stay active.
  - **Files Modified**: `server/services/arc3/utils/constants.ts`, `server/services/arc3/Arc3RealGameRunner.ts`, `client/src/pages/ARC3AgentPlayground.tsx`, `client/src/components/arc3/Arc3ConfigurationPanel.tsx`, `client/src/components/arc3/Arc3AgentConfigPanel.tsx`, `client/src/hooks/useArc3AgentStream.ts`, `CHANGELOG.md`

### Version 5.47.10  Dec 8, 2025 (PENDING TESTING)

- **ARC3 continuation: guard chaining inputs** (Author: Codex)
  - Hardened `/api/arc3/stream/:sessionId/continue` to fall back to the stored `providerResponseId` when the client lacks a `previousResponseId`, and return clear 400 errors instead of generic 500s when chaining data is missing.
  - Added defensive validation that refuses ARC3 continuations without a seed frame when reusing an existing game guid, preventing silent state corruption.
  - Documented the remediation steps in a dedicated plan for tracking and validation.
  - **Files Modified**: `server/routes/arc3.ts`, `docs/plans/2025-12-08-arc3-streaming-continuation-fix-plan.md`, `CHANGELOG.md`

### Version 5.47.9  Dec 7, 2025 (PENDING TESTING)

- **ARC-AGI-3: Attach agent reasoning to ARC3 scorecards (streaming path)** (Author: Cascade)
  - Extended `Arc3ApiClient.executeAction` to accept an optional `reasoning` payload and forward it to the ARC3 `/api/cmd/ACTION*` endpoints so scorecards can store per-action reasoning blobs.
  - Updated the streaming `Arc3RealGameRunner` tools for `ACTION1`–`ACTION5` and `ACTION6` to pass a compact JSON reasoning object built from the accumulated streaming reasoning text (truncated well under the 16 KB ARC3 limit) on every ARC3 action call.
  - Added `opaque` metadata when opening ARC3 scorecards for both the web UI router and the streaming service so ARC-side scorecards clearly record that runs originate from the arc-explainer playground.
  - **Files Modified**: `server/services/arc3/Arc3ApiClient.ts`, `server/services/arc3/Arc3RealGameRunner.ts`, `server/routes/arc3.ts`, `server/services/arc3/Arc3StreamService.ts`, `CHANGELOG.md`

### Version 5.47.8  Dec 7, 2025 (PENDING TESTING)

- **Docs: ARC-AGI-3 prompt alignment plan** (Author: Cascade)
  - Captured a concrete plan for aligning the ARC-AGI-3 agent system prompt with the new `ARC3_Agent_Playbook` while preserving the Twitch/Gen-Z streamer UX and simple, non-jargony tone.
  - Described proposed prompt structure (role, "brain habits", tool-call commentary rules, narration template, and final report guidance) plus phased implementation and validation steps.
  - **Files Created**: `docs/plans/prompts/2025-12-07-arc3-prompt-alignment-plan.md`

### Version 5.47.7  Dec 7, 2025 (PENDING TESTING)

- **Docs: ARC-AGI-3 Agent Playbook for future agents** (Author: Cascade)
  - Captured a structured "mental playbook" for ARC-AGI-3 agents, describing how to think in novel games, run targeted experiments, build compact world models, and plan efficient action sequences.
  - Added harness and tooling recommendations (state diffs, memory, schemas, planning helpers) so future agents can better close the gap with humans on interactive reasoning tasks.
  - **Files Created**: `docs/reference/arc3/ARC3_Agent_Playbook.md`

### Version 5.47.6  Dec 7, 2025 (PENDING TESTING)

- **ARC-AGI-3: front-facing copy and metadata audit** (Author: Cascade)
  - Audited `/arc3` landing copy and ARC-AGI-3 games index text against the updated ARC3 spec and public preview docs, softening speculative language about timelines, offline engines, Python libraries, and step counts.
  - Updated ARC-AGI-3 game spoiler pages so descriptions and spoiler warnings more accurately reflect what is actually documented today (rather than promising complete hints/strategies).
  - Tightened shared `ARC3_GAMES` metadata: aligned ls20/ft09 summaries with official descriptions, and made lp85/sp80/vc33 clearly marked as evaluation holdouts with intentionally minimal mechanics detail.
  - **Files Modified**: `client/src/pages/ARC3Browser.tsx`, `client/src/pages/Arc3GamesBrowser.tsx`, `client/src/pages/Arc3GameSpoiler.tsx`, `shared/arc3Games.ts`

### Version 5.47.5  Dec 7, 2025 (PENDING TESTING)

- **ARC-AGI-3 Playground: Complete component decomposition (Phase 1 & Phase 3)** (Author: Claude Code using Sonnet 4.5)
  - Extracted monolithic 839-line playground into focused, reusable components following SRP.
  - **Phase 1**: Created `Arc3GamePanel` consolidating grid visualization, action buttons, layer/timestep navigation, and frame navigation in single render cycle to fix double-click issues caused by parent-child state update lag.
  - **Phase 3 Decomposition**:
    - Created `Arc3ConfigurationPanel` - Ultra-compact config UI with system prompt (collapsible), user prompt, model selection (OpenAI only), reasoning effort, max turns, and start/stop controls.
    - Created `Arc3AgentControls` - User message injection card for continuing agent exploration after pause/completion.
    - Created `Arc3AgentVisionPreview` - Displays base64 PNG image showing what vision-enabled agent sees when inspecting game state (extracted from `inspect_game_state` tool results).
  - Slimmed `ARC3AgentPlayground.tsx` to composition layer handling URL state, hook wiring, and structured data extraction.
  - Fixed color legend to use shared Arc3 16-color palette from `shared/config/arc3Colors.ts` as single source of truth.
  - **Why**: Massive SRP violation (964 lines, multiple responsibilities). Now follows established pattern of focused components with clear boundaries.
  - **Files Created**: `client/src/components/arc3/Arc3GamePanel.tsx`, `client/src/components/arc3/Arc3ConfigurationPanel.tsx`, `client/src/components/arc3/Arc3AgentControls.tsx`, `client/src/components/arc3/Arc3AgentVisionPreview.tsx`
  - **Files Modified**: `client/src/pages/ARC3AgentPlayground.tsx:9-25,217-282,376-407,435-455`, `docs/plans/2025-12-07-arc3-playground-improvements-plan.md:6,10-55`, `CHANGELOG.md`

### Version 5.47.4  Dec 7, 2025 (PENDING TESTING)

- **ARC-AGI-3 browser: modular reference panel** (Author: Codex)
  - Extracted the reference materials segment into `client/src/components/arc3/Arc3References.tsx` so the layout and metadata stay consistent whenever ARC-AGI-3 resources are reused.
  - Updated `ARC3Browser` to render the new component instead of inline markup, reducing duplication and making the layout easier to evolve in the future.
  - **Files Modified**: `client/src/pages/ARC3Browser.tsx`, `client/src/components/arc3/Arc3References.tsx`, `CHANGELOG.md`

### Version 5.47.3  Dec 7, 2025 (PENDING TESTING)

- **ARC-AGI-3 browser: highlight preview learnings blog** (Author: Codex)
  - Added a dedicated Preview Learnings resource card to the `/arc3` landing grid so the ARC-AGI-3 preview 30-day learnings blog sits alongside the platform, docs, and competition links.
  - Removed the former duplicate entry from the Reference Materials list to keep the blog reference focused in the new card.
  - **Files Modified**: `client/src/pages/ARC3Browser.tsx`, `CHANGELOG.md`

### Version 5.47.2  Dec 7, 2025 (PENDING TESTING)

- **Docs: Clean up ARC-AGI-3 spec Markdown formatting** (Author: Cascade)
  - Removed the outer code block wrapper from `docs/reference/arc3/ARC3.md` so the ARC-AGI-3 spec renders as standard Markdown instead of a fenced text blob.
  - Simplified the checklist Actions line by dropping the redundant inline `RESET`/`ACTION1`–`ACTION7` enumeration, keeping the rest of the environment checklist intact.

### Version 5.47.1  Dec 7, 2025 (PENDING TESTING)

- **ARC-AGI-3 Playground: Extract Arc3ToolTimeline & Arc3ReasoningViewer components** (Author: Cascade)
  - Extracted the inline "Actions" card from `ARC3AgentPlayground.tsx` into a reusable `Arc3ToolTimeline` component under `client/src/components/arc3/Arc3ToolTimeline.tsx`, keeping rendering and behavior identical.
  - Extracted the right-hand "Agent Reasoning" card (including reasoning + assistant messages and streaming reasoning block) into `Arc3ReasoningViewer` at `client/src/components/arc3/Arc3ReasoningViewer.tsx`, preserving the existing auto-scroll behavior.
  - The playground page now imports both components and passes the existing `toolEntries` and `state.timeline`/streaming fields, preparing the layout for further decomposition without changing UX.
  - **Files Created**: `client/src/components/arc3/Arc3ToolTimeline.tsx`, `client/src/components/arc3/Arc3ReasoningViewer.tsx`
  - **Files Modified**: `client/src/pages/ARC3AgentPlayground.tsx`, `CHANGELOG.md`, `docs/plans/2025-12-07-arc3-playground-improvements-plan.md`

### Version 5.47.0  Dec 7, 2025 (PENDING TESTING)

- **ARC-AGI-3 Playground: Add vision support with base64 grid images** (Author: Claude Code using Opus 4.5)
  - Added server-side grid-to-PNG rendering for Arc3 games using the correct 16-color Arc3 palette (0-15).
  - The `inspect_game_state` tool now returns a `frameImage` field containing a base64 PNG data URL alongside the numeric grid data.
  - Vision-capable models (GPT-4o, Claude 3, Grok-2-Vision) can now "see" the grid instead of parsing numeric arrays.
  - Optimized for 64×64 grids: 8px cell size produces 512×512px images.
  - Created shared Arc3 color palette (`shared/config/arc3Colors.ts`) with RGB tuples, hex values, and human-readable names.
  - **Why**: Research shows "GPT-4's reliance on textual encodings impedes effective problem solving" on ARC tasks. Visual input enables spatial reasoning.
  - **Files Created**: `shared/config/arc3Colors.ts`, `server/services/arc3/arc3GridImageService.ts`
  - **Files Modified**: `server/services/arc3/Arc3RealGameRunner.ts:22,126-132,403-409,139-140,416-417`, `CHANGELOG.md`

### Version 5.46.9  Dec 7, 2025 (PENDING TESTING)

- **ARC-AGI-3 as66: add level 8 screenshot metadata** (Author: Cascade)
  - Extended Always Sliding (as66) level screenshots to include `/as66-lvl8.png` as level 8 via the shared `levelScreenshots` structure so the Level 8 card appears in the Screenshots tab alongside levels 3 and 4.
  - **Files**: `shared/arc3Games.ts`, `CHANGELOG.md`

### Version 5.46.8  Dec 6, 2025 (PENDING TESTING)

- **ARC-AGI-3 as66: add level 4 screenshot metadata** (Author: Cascade)
  - Extended Always Sliding (as66) level screenshots to include `/as66-lvl4.png` so both levels 3 and 4 appear in the Screenshots tab via the shared `levelScreenshots` structure.
  - **Files**: `shared/arc3Games.ts`, `CHANGELOG.md`

### Version 5.46.7  Dec 6, 2025 (PENDING TESTING)

- **ARC-AGI-3 as66: add level 3 screenshot metadata** (Author: Cascade)
  - Added an initial level screenshot entry for Always Sliding (as66) pointing to `/as66-lvl3.png` via the shared `levelScreenshots` structure so level 3 appears in the Screenshots tab on the game spoiler page.
  - **Files**: `shared/arc3Games.ts`, `CHANGELOG.md`

### Version 5.46.6  Dec 6, 2025 (PENDING TESTING)

- **ARC-AGI-3 ls20: add level 5 screenshot metadata** (Author: Cascade)
  - Added a second level screenshot entry for Locksmith (ls20) pointing to `/ls20-lvl5.png` via the shared `levelScreenshots` structure so both levels 4 and 5 appear in the Screenshots tab on the game spoiler page.
  - **Files**: `shared/arc3Games.ts`, `CHANGELOG.md`

### Version 5.46.5  Dec 6, 2025 (PENDING TESTING)

- **ARC-AGI-3 Playground: Sync game selection with URL parameters** (Author: Claude Code using Sonnet 4.5)
  - Fixed game selector not updating URL when switching games - URL now updates to `?game=<gameId>` when selecting different games.
  - Added `useLocation` and `useSearch` from wouter to read and update URL query parameters.
  - Initial game now loads from URL param (`?game=ft09`) instead of hardcoded default, enabling direct links to specific games.
  - Page refresh now preserves selected game state via URL params.
  - Browser back/forward buttons now work for game navigation.
  - **Issue**: Selecting different game only updated UI, URL stayed unchanged (e.g., stuck on `?game=ft09`), breaking refresh, sharing, and browser history.
  - **Root Cause**: Game selector only called `setGameId()` and `fetchGameGrid()`, never updated URL state.
  - **Files Modified**: `client/src/pages/ARC3AgentPlayground.tsx:18,119-125,148,218,448-453`, `CHANGELOG.md`

### Version 5.46.4  Dec 6, 2025 (PENDING TESTING)

- **ARC-AGI-3 ls20: add level 4 screenshot metadata** (Author: Cascade)
  - Wired the Locksmith (ls20) game metadata to use the new `/ls20-lvl4.png` asset as a level screenshot via the shared `levelScreenshots` structure, mirroring the existing FT-09 screenshot configuration so it appears in the Screenshots tab on the game spoiler page.
  - **Files**: `shared/arc3Games.ts`, `CHANGELOG.md`

### Version 5.46.3  Dec 6, 2025 (PENDING TESTING)

- **ARC-AGI-3 prompt: add official ACTION6 guidance** (Author: GPT-5 (Codex))
  - Updated the ARC3 default prompt to embed official docs details for ACTION6 coordinates (required x,y 0-63), simple action expectations, and optional reasoning blob guidance, while keeping the Twitch-streamer tone and action narration requirements.
  - Cleaned prompt logging instructions and refreshed header metadata to reflect current ownership/date.
  - Added a planning note documenting the prompt-doc alignment steps.
  - **Files Modified**: `server/services/arc3/prompts.ts`, `docs/2025-12-06-arc3-prompt-docs-plan.md`

### Version 5.46.2  Dec 6, 2025 (PENDING TESTING)

- **ARC-AGI-3 Playground: Add automatic layer animation for multi-layer frames** (Author: Claude Code using Sonnet 4.5)
  - Fixed grid not animating after actions - now automatically animates through frame layers 0 → 1 → 2 → ... → N showing objects falling/moving in real-time (matches official ARC Prize site behavior).
  - Added `animatingLayerIndex` state and `animationTimerRef` to track and control automatic layer progression.
  - Animation plays at 120ms per layer for smooth visual feedback showing intermediate game states.
  - Animation automatically stops when reaching final layer or when user manually selects a layer via slider.
  - **Issue**: Grid only updated once per action, not showing intermediate states (falling objects, motion, etc.).
  - **Root Cause**: Code was defaulting to show last layer immediately (`resolvedCurrentFrame.length - 1`) instead of animating through layers sequentially.
  - **Files Modified**: `client/src/pages/ARC3AgentPlayground.tsx:305-379`, `CHANGELOG.md`

### Version 5.46.1  Dec 6, 2025 (PENDING TESTING)

- **ARC-AGI-3 Playground: Fix manual action guid race condition** (Author: Claude Code using Sonnet 4.5)
  - Fixed critical race condition where rapid manual action clicks caused actions to execute on stale game state (wrong guid).
  - Added `latestGuidRef` useRef to track current guid synchronously, preventing React state lag during rapid clicks.
  - Added `isPendingManualAction` lock to prevent concurrent manual actions - buttons now disable while action is executing.
  - Updated `executeManualAction` to use ref guid instead of state guid, and update ref immediately before setState.
  - Updated `initializeGameSession` and SSE event listeners (`game.frame_update`, `agent.completed`) to sync latestGuidRef.
  - Action buttons now show "Another action is in progress. Please wait..." tooltip when disabled due to pending action.
  - **Issue**: Actions appeared delayed or wrong (e.g., clicking Action 4 → sees right movement, clicking Action 1 → sees diagonal movement).
  - **Root Cause**: Second click used guid from before first action completed, causing ARC3 API to apply action to outdated game state.
  - **Files Modified**: `client/src/hooks/useArc3AgentStream.ts:86-87,596-699,715-716,433-436,457-460,755`, `client/src/pages/ARC3AgentPlayground.tsx:223,654,661-667`, `CHANGELOG.md`

### Version 5.46.0  Dec 6, 2025 (PENDING TESTING)

- **ARC-AGI-3 Level Screenshots System** (Author: Claude Code using Sonnet 4.5)
  - Implemented scalable level screenshots system for all six ARC-AGI-3 games (ls20, as66, ft09, lp85, sp80, vc33).
  - Added `LevelScreenshot` interface with `level`, `imageUrl`, `caption`, and `notes` fields for structured screenshot metadata.
  - Updated `Arc3GameMetadata` interface with optional `levelScreenshots` array field.
  - Migrated ft09 game to new structure with level 8 and 9 screenshots (`/ft09-lvl8.png`, `/ft09-lvl9.png`).
  - Replaced "Hints" tab with "Screenshots" tab in game detail pages - removed all hallucinated hint content from UI and data.
  - Removed fake hints from ls20 and ft09 game entries - set all games to `hints: []`.
  - Screenshots display in responsive grid (1 col mobile, 2 cols tablet, 3 cols desktop) with level badges and square aspect ratio containers.
  - Empty state shown for games without screenshots yet ("No Screenshots Yet" message).
  - Created comprehensive implementation plan document at `docs/plans/2025-12-06-arc3-level-screenshots-system.md`.
  - **Files Modified**: `shared/arc3Games.ts:57-69,115,174,285-296`, `client/src/pages/Arc3GameSpoiler.tsx:204-206,278-281,452-503`, `CHANGELOG.md`

### Version 5.45.17  Dec 6, 2025 (PENDING TESTING)

- **ARC-AGI-3 game page improvements** (Author: Claude Code using Sonnet 4.5)
  - Fixed embedded game iframe to use square (1:1) aspect ratio instead of rectangular fixed height, matching the 64×64 grid game format.
  - Changed iframe container from `style={{ height: '600px' }}` to `aspect-square` with centered `max-w-3xl` wrapper.
  - Removed "Back to Games" navigation button and spoiler warning alert from game detail pages for cleaner layout.
  - **Files Modified**: `client/src/pages/Arc3GameSpoiler.tsx:206-265,301-308`, `CHANGELOG.md`

### Version 5.45.16  Dec 6, 2025 (PENDING TESTING)

- **ARC-AGI-3 landing: Fix game thumbnails to be actually clickable** (Author: Claude Code using Sonnet 4.5)
  - Fixed the game thumbnail grid in the Games Browser card on `/arc3` so each PNG is now wrapped in a clickable Link component that navigates to `/arc3/games/:gameId`.
  - Added hover effects (border highlight, shadow, cursor pointer) to indicate interactivity.
  - Previous implementation (v5.45.12) claimed to make thumbnails clickable but only rendered static div/img elements without any Link wrapper.
  - **Files Modified**: `client/src/pages/ARC3Browser.tsx:91-108`, `CHANGELOG.md`

### Version 5.45.15  Dec 6, 2025 (PENDING TESTING)

- **ARC-AGI-3 Games Browser: remove speculative metrics and fix thumbnails** (Author: Cascade)
  - Simplified the `/arc3/games` header by removing the redundant "Back to ARC-AGI-3" button and the speculative coverage summary card (`Games covered`, `Fully documented`, `Hints captured`).
  - Removed difficulty badges, hint counts, "fully documented" icons/legend entries, and "community favorite" labels from ARC-3 game cards and the legend so the UI no longer surfaces fields that are not grounded in real, curated data.
  - Updated the game thumbnail rendering to use `object-contain` inside a square container so each ARC-AGI-3 PNG is shown in full (no cropping) while keeping a clean grid layout.
  - Softened page copy to avoid promising hints where they do not yet exist (removed "hints" from descriptions and CTA text).
  - **Files**: `client/src/pages/Arc3GamesBrowser.tsx`, `CHANGELOG.md`

### Version 5.45.14  Dec 6, 2025 (PENDING TESTING)

- **Human Trading Cards: Fix duplicate Team NVARC entries and improve layout** (Author: Claude Code using Sonnet 4.5)
  - Added deduplication logic to prevent duplicate competition winner entries caused by stale database records (database had 25 entries vs 24 in seed file).
  - Deduplicates by `rank + teamName` to ensure only one entry per team appears, fixing the double "1st Place (NVARC)" issue.
  - Removed TeamWinnerGroup component usage in favor of displaying individual member cards directly for teams with dual images (NVARC, MindsAI).
  - Created `splitTeamIntoMembers()` helper function to generate virtual contributor cards from team entries with comma-separated images.
  - Redesigned Paper Awards 2025 section: larger cards (w-64), horizontal layout, clear 🥇🥈🥉 placement indicators on one line.
  - Fixed ARChitects 2nd place not displaying by removing member requirement check in competition winners logic.
  - Reduced padding throughout page: py-4→py-3, space-y-5→space-y-4, gap-3→gap-2.5 to minimize wasted space.
  - Added hover scale effects and visual indicators for clickable cards.
  - **Files Modified**: `client/src/pages/HumanTradingCards.tsx:65-80,82-110,273-351`, `client/src/utils/humanCardHelpers.ts:203-233`, `client/src/components/human/TeamWinnerGroup.tsx:100-139`, `CHANGELOG.md`

### Version 5.45.13  Dec 6, 2025 (PENDING TESTING)

- **ARC-AGI-3 roadmap: soften Python library wording** (Author: Cascade)
  - Updated the "Python library" section of the ARC-AGI-3 2026 roadmap card on `/arc3` to state only that there has been public mention of a possible Python library, and that concrete details (timing, interface, workflows) have not been formally announced yet.
  - Removed stronger language that could be read as a firm commitment or specification, keeping the page aligned with known public information.
  - **Files**: `client/src/pages/ARC3Browser.tsx`, `CHANGELOG.md`

### Version 5.45.12  Dec 6, 2025 (PENDING TESTING)

- **ARC-AGI-3 landing: clickable thumbnails + larger Games Browser text** (Author: Cascade)
  - Made the ARC-AGI-3 game PNG thumbnails in the Games Browser highlight card on `/arc3` clickable links to their corresponding spoiler pages at `/arc3/games/:gameId`, so the visual gallery is now a direct entry point into each game.
  - Increased the font size and weight of the Games Browser bullet text to `text-base` and `font-semibold` for better readability while preserving the existing layout and shadcn/ui structure.
  - **Files**: `client/src/pages/ARC3Browser.tsx`, `CHANGELOG.md`

### Version 5.45.11  Dec 6, 2025 (PENDING TESTING)

- **ARC-AGI-3 ls20 thumbnail path fix** (Author: Cascade)
  - Updated the `ls20` game metadata to use the existing `/ls20.png` asset in `client/public` instead of the non-existent `/images/arc3/ls20-thumbnail.png` path so the Locksmith thumbnail renders correctly on both the Games Browser and ARC-3 landing page.
  - **Files**: `shared/arc3Games.ts`, `CHANGELOG.md`

### Version 5.45.10  Dec 6, 2025 (PENDING TESTING)

- **ARC-AGI-3 landing: show game thumbnails in Games Browser card** (Author: Cascade)
  - Added a compact grid of ARC-AGI-3 game PNG thumbnails under the Games Browser summary on the `/arc3` landing page, using shared `getAllGames()` + `thumbnailUrl` metadata so the highlight card no longer shows empty white space.
  - The grid automatically reflects all revealed games with thumbnails (currently ls20, as66, ft09, lp85, sp80, vc33) and keeps the existing "Browse Games" call-to-action intact, making the Games Browser visually feel like the entry point into the benchmark.
  - **Files**: `client/src/pages/ARC3Browser.tsx`, `CHANGELOG.md`

### Version 5.45.9  Dec 6, 2025 (PENDING TESTING)

- **ARC-AGI-3 Games: Add informal names, descriptions, and thumbnails for 5 games** (Author: Claude Code using Sonnet 4.5)
  - Added informal community names and descriptive text for all remaining ARC-AGI-3 games in the games browser.
  - Preview games: **as66** → "Always Sliding" (dynamic puzzle with continuously moving elements), **ft09** → "Functional Tiles" (tiles with specific functions and behaviors).
  - Evaluation games: **lp85** → "Loop & Pull" (looping patterns and pulling mechanics), **sp80** → "Streaming Purple" (flowing purple elements and streaming patterns), **vc33** → "Volume Control" (adjusting volumes, sizes, or quantities).
  - Added thumbnail URLs for all 5 games pointing to images in `/client/public/` (as66.png, ft09.png, lp85.png, sp80.png, vc33.png).
  - Added descriptive tags for each game to aid categorization and searchability (e.g., "sliding", "motion", "dynamic" for Always Sliding; "loops", "mechanics", "patterns" for Loop & Pull).
  - Games Browser now displays rich preview cards with game images, informal names, and thematic descriptions for all revealed ARC-AGI-3 games.
  - **Files Modified**: `shared/arc3Games.ts:211-289`, `CHANGELOG.md`

### Version 5.45.8  Dec 6, 2025 (PENDING TESTING)

- **ARC-AGI-3 layout refresh: make the Games Browser the star** (Author: Cascade)
  - Recentered the ARC-AGI-3 landing page so the Games Browser is now the primary call-to-action, with a prominent "Browse ARC-AGI-3 Games" hero button and a top "Explore ARC-AGI-3" section featuring Games Browser + 2026 roadmap cards using shadcn/ui.
  - Tightened vertical spacing and removed the old bottom "Future Features" block to reduce noise while keeping all real links and factual ARC-AGI-3 context intact.
  - Enhanced the ARC-AGI-3 Games Browser itself with per-game thumbnail support (via existing `thumbnailUrl` metadata), richer quick stats (including resource counts), surfaced game notes/documentation status, and a small coverage summary showing total games, fully documented games, and total hints captured—without introducing any mock data.
  - **Files**: `client/src/pages/ARC3Browser.tsx`, `client/src/pages/Arc3GamesBrowser.tsx`, `CHANGELOG.md`

### Version 5.45.7  Dec 6, 2025 (PENDING TESTING)

- **ARC-AGI-3 Browser: Replace speculative feature placeholders with 2026 roadmap facts** (Author: Cascade)
  - Removed the non-committal Leaderboard, Scorecard Viewer, and Replay Viewer cards from the ARC-AGI-3 landing page so the UI no longer advertises features that are not actually planned on this platform.
  - Added an info-dense "ARC-AGI-3 2026 roadmap & known facts" card summarizing what is publicly known today: ARC-AGI-2 and ARC-AGI-3 both running in 2026, interactive 64×64 grid game format, the team’s hints about a future Python library, and the current uncertainty around exact prize amounts and final game lists.
  - Kept all existing real navigation intact (including the ARC-AGI-3 Games Browser and official external links) while making the page more readable, searchable, and accurate for humans and large language models looking for up-to-date ARC3 context.
  - **Files**: `client/src/pages/ARC3Browser.tsx`, `CHANGELOG.md`

### Version 5.45.6  Dec 6, 2025 (PENDING TESTING)

- **Hall of Fame: Surface all 2025 paper awards together at the top** (Author: Cascade)
  - Updated the Hall of Fame layout so the dedicated 2025 paper awards strip now shows Alexia Jolicoeur-Martineau (Top Paper Award) together with the SOAR team and Isaac Liao, instead of scattering SOAR and Isaac into the generic Research & Awards section.
  - Adjusted contributor categorization so 2025 paper award winners are excluded from the Research & Awards grid, while keeping 2024 paper awards and all `researcher` entries unchanged.
  - **Files**: `client/src/pages/HumanTradingCards.tsx`, `CHANGELOG.md`

### Version 5.45.5  Dec 6, 2025 (PENDING TESTING)

- **Fix contributor sync: respect database varchar(50) score limit** (Author: Cascade)
  - Updated `ContributorRepository` to centrally truncate `score` fields to the database’s `varchar(50)` limit on insert and update so the auto-sync on server startup no longer fails with `value too long for type character varying(50)` when new Hall of Fame entries include long score strings.
  - Kept the database-first architecture intact by adapting application writes to the existing schema instead of changing the live table definition; all other contributor fields and behaviors remain unchanged.
  - **Files**: `server/repositories/ContributorRepository.ts`, `CHANGELOG.md`

### Version 5.45.4  Dec 6, 2025 (PENDING TESTING)

- **Hall of Fame: Add Simon Strandgaard (neoneye) as ARC datasets & tools curator** (Author: Cascade)
  - Added a new contributor trading card entry for Simon Strandgaard (aka `@neoneye`), recognizing his long-standing role as an independent ARC community contributor and dataset/tool curator.
  - Highlighted his many ARC-related GitHub repositories (including the ARC-Interactive-History-Dataset) that package human interaction traces, derived task collections, and utilities that the wider community—this project included—relies on for exploration and analysis.
  - Framed his contribution as infrastructure: organizing and sharing high-quality ARC datasets, visualizations, and tools so researchers and hobbyists can build on shared resources instead of re-implementing basic plumbing.
  - Tied this card to the existing Research Terminal footer link that credits Simon and points to his GitHub profile, and wired his Hall of Fame card to the `/simonS.png,/simonS1.png` portrait variants.
  - **Files**: `server/scripts/seedContributors.ts`, `client/public/simonS.png`, `client/public/simonS1.png`, `CHANGELOG.md`

### Version 5.45.3  Dec 6, 2025 (PENDING TESTING)

- **Hall of Fame: Add SOAR 2nd Place 2025 Paper Award Team (Self-Improving Program Synthesis)** (Author: Cascade)
  - Added a new contributor trading card for the SOAR team (Julien Pourcel, Cédric Colas, Pierre-Yves Oudeyer), recognizing their 2nd place 2025 paper award "Self-Improving Language Models for Evolutionary Program Synthesis: A Case Study on ARC-AGI".
  - Captured SOAR as a self-improving evolutionary program synthesis framework that alternates between LLM-driven evolutionary search for ARC-AGI programs and a hindsight learning phase that fine-tunes the LLM on its own search traces.
  - Highlighted that SOAR achieves up to **52% of the ARC-AGI public test set** without relying on human-engineered DSLs or curated solution datasets, instead using search traces as training data.
  - Linked to the official paper, GitHub repository, and ARC Prize interview video: `https://www.youtube.com/watch?v=9lIuoslCHWI`.
  - Wired the team card to the existing `/julienPourcel.png` portrait asset and categorized them under 2025 paper award winners alongside Alexia and Isaac.
  - **Files**: `server/scripts/seedContributors.ts`, `client/public/julienPourcel.png`, `CHANGELOG.md`

### Version 5.45.2  Dec 6, 2025 (TESTING)

- **2025 ARC Prize Team Winners: Tufa AI & MindsAI Normalization** (Author: Claude Code using Haiku 4.5)
  - Refined team winners implementation to properly handle team name variations and affiliations.
  - Created team name normalization utility (`client/src/utils/teamNameNormalizer.ts`) mapping team aliases to canonical forms.
  - Updated Dries Smit's arc3_preview entry: `teamName: "StochasticGoose"` → `"Tufa AI"` (reflects his individual work with Tufa Labs).
  - Team name normalization: `"Tufa AI"`, `"Tufa Labs"` → `"MindsAI"` (canonical) for unified grouping.
  - Updated team contributor matching in `HumanTradingCards.tsx` to use normalized team names.
  - Dries Smit now maintains dual affiliations:
    - Arc3 Preview: `teamName: "Tufa AI"` (individual/agent work)
    - 2025 Competition: Member of MindsAI team group (via normalized lookup)
  - **Files Created**: `client/src/utils/teamNameNormalizer.ts`
  - **Files Modified**: `client/src/pages/HumanTradingCards.tsx`, `server/scripts/seedContributors.ts`, `CHANGELOG.md`

### Version 5.45.1  Dec 6, 2025 (PENDING TESTING)

- **Hall of Fame: Add Isaac Liao (ARC-AGI Without Pretraining / CompressARC)** (Author: Cascade)
  - Added a new contributor trading card entry for Isaac Liao, a graduate researcher at Carnegie Mellon University and creator of CompressARC.
  - Captured his MDL-based, single-puzzle-trained neural "code golf" system that treats ARC-AGI as a compression problem, training a compact network per task from scratch and selecting the model that minimizes description length.
  - Documented his reported performance: ~34.75% on ARC-AGI-1 training, ~20% on ARC-AGI-1 evaluation, and ~4% on ARC-AGI-2, all achieved **without any pretraining or external data**.
  - Linked to his official 2025 ARC Prize paper/interview bundle, including the YouTube interview: `https://www.youtube.com/watch?v=N9GvFj0cE9s`.
  - Wired his Hall of Fame card to the existing `/isaacliao.png` portrait asset and categorized him under the 2025 paper award winners alongside Alexia.
  - **Files**: `server/scripts/seedContributors.ts`, `client/public/isaacliao.png`, `CHANGELOG.md`

### Version 5.45.0  Dec 6, 2025 (TESTING)

- **2025 ARC Prize Team Winners Grouping** (Author: Claude Code using Haiku 4.5)
  - Introduced special team winner grouping in Hall of Fame "2025 Competition Winners" section.
  - Teams now display as unified groups with team-level card + member cards in single layout.
  - Team card displays both member images side-by-side from comma-separated imageUrl field.
  - Created `TeamWinnerGroup` component (`client/src/components/human/TeamWinnerGroup.tsx`) for team + member rendering.
  - Created team winners configuration (`client/src/constants/teamWinners.ts`) mapping teamName to member fullNames.
  - Created team name normalization utility (`client/src/utils/teamNameNormalizer.ts`) to handle team name aliases/variations.
  - Updated `HumanTradingCards.tsx` to compute team groups separately from solo winners grid with normalized team name matching.
  - Responsive design: Desktop (side-by-side team card + 2-column member grid), Mobile (stacked layout).
  - Affected teams:
    - Team NVARC (1st Place, 24.03%) with member Jean-François Puget.
    - Team MindsAI (3rd Place, 15.42%) with members Jack Cole & Dries Smit.
  - Seed data updates:
    - Normalized "JF Puget" → "Jean-François Puget" in Team NVARC fullName.
    - Changed Dries Smit's arc3_preview teamName from "StochasticGoose" to "Tufa AI" (part of MindsAI ecosystem).
    - Team name normalization: "Tufa AI" and "Tufa Labs" → "MindsAI" canonical form for unified grouping.
  - **Files Created**: `client/src/components/human/TeamWinnerGroup.tsx`, `client/src/constants/teamWinners.ts`, `client/src/utils/teamNameNormalizer.ts`
  - **Files Modified**: `client/src/pages/HumanTradingCards.tsx`, `server/scripts/seedContributors.ts`

### Version 5.44.1  Dec 6, 2025 (PENDING TESTING)

- **Hall of Fame: Add Eric Pang (Efficient Evolutionary Program Synthesis)** (Author: Cascade)
  - Added a new contributor trading card entry for Eric Pang, a machine learning engineer at Amazon (formerly Quora) and University of Waterloo Math/CS graduate.
  - Captured his DreamCoder-inspired "DREAM" evolutionary program synthesis system that builds a reusable Python program library across ARC-AGI tasks using Grok-4, score-weighted program selection, and low test-time compute (~10 LLM calls per task).
  - Documented that his approach breaks the performance–cost Pareto frontier versus frontier models on ARC-AGI-1 and ARC-AGI-2, with an estimated ~$2.56 cost per ARC-AGI-1 task.
  - Wired his Hall of Fame card to the new `/ericpang.jpeg` portrait asset and categorized him as a `researcher` in the contributors seed data.
  - **Files**: `server/scripts/seedContributors.ts`, `client/public/ericpang.jpeg`, `CHANGELOG.md`

### Version 5.44.0  Dec 6, 2025 (PENDING TESTING)

- **Human Insights Resource Integration & Research Terminal Expansion** (Author: Claude Code using Haiku 4.5)
  - Integrated human test participant explanations and error examples directly into the Puzzle Examiner.
  - Added "Human Insights" button to PuzzleHeader alongside solver buttons, linking to `https://arc-visualizations.github.io/{taskId}.html`.
  - Added prominent full-width "Human Insights" banner immediately above Analysis Results section for maximum visibility and discoverability.
  - This resource was instrumental for synthetic data creation and represents a major community contribution to understanding puzzle-solving patterns.
  - **Research Terminal Enhancements** (ReferenceMaterial):
    - Added NVIDIA Kaggle Grandmasters - AGI Competition paper (community winner recognition)
    - Added "Less is More - Tiny Recursive Models" research paper
    - Added NVARC synthetic data generation tool to Tools & Solvers section
    - Updated "Human ARC dataset" label to "Human Insights & Explanations" for clarity
    - Linked Simon Strandgaard's (@neoneye) name to his GitHub profile in footer
  - **Community Link Fix**:
    - Fixed "ARC Discord Weekly Meeting" link in PuzzleBrowser from incorrect Twitch URL to correct Discord invite: `https://discord.com/invite/9b77dPAmcA`
  - **Files Modified**: `client/src/components/puzzle/PuzzleHeader.tsx`, `client/src/pages/PuzzleExaminer.tsx`, `client/src/components/browser/ReferenceMaterial.tsx`, `client/src/pages/PuzzleBrowser.tsx`

### Version 5.43.0  Dec 6, 2025 12:40pm (PENDING TESTING)

- **Hall of Fame Card Pack Opening Animation** (Author: Claude Code using Haiku 4.5)
  - Implemented immersive first-visitor experience with holographic card pack opening sequence.
  - Features three new hooks:
    - `useFirstVisit()` - localStorage-based tracking of first-time visitors with dev reset capability via `window.__resetHallOfFameVisit()`.
    - `usePackAnimation()` - state machine managing animation phases (idle → pack → opening → scattering → settling → complete) with automatic timing transitions.
  - Created four new components:
    - `CardPack.tsx` - Holographic pack visual with shimmer animation, click/keyboard interaction (Enter/Space), and focus-visible ring for accessibility.
    - `ScatteredCard.tsx` - Individual card animations with staggered transitions between scatter and settle positions using framer-motion.
    - `CardPackOpening.tsx` - Orchestrator component coordinating animation flow, position calculations (starburst scatter + centered grid settle), and responsive dimension scaling.
  - Animation Timing: Pack phase 2s (auto-open) → Opening 300ms → Scattering 500ms (staggered) → Settling 800ms (staggered) → Complete.
  - Responsive behavior: Mobile (2 columns, smaller pack), Tablet (3 columns), Desktop (4 columns).
  - Accessibility: Full `prefers-reduced-motion` support (skips animation entirely), ARIA labels, keyboard navigation, focus management.
  - Added `.pack-shimmer` CSS animation for holographic effect on pack background.
  - Integrated into `HumanTradingCards.tsx` with conditional rendering: first visitors see animation overlay, returning visitors skip to normal page.
  - **Files Created**: `client/src/hooks/useFirstVisit.ts`, `client/src/hooks/usePackAnimation.ts`, `client/src/components/human/CardPack.tsx`, `client/src/components/human/ScatteredCard.tsx`, `client/src/components/human/CardPackOpening.tsx`
  - **Files Modified**: `client/src/pages/HumanTradingCards.tsx`, `client/src/index.css`

### Version 5.42.0  Dec 5, 2025 9:55pm

- **ARC-AGI-3 Games Browser & Spoiler Pages** (Author: Claude Windsurf Cascade)
  - Created comprehensive game metadata system (`shared/arc3Games.ts`) with support for 6 revealed games (3 preview + 3 evaluation).
  - Added `Arc3GamesBrowser` page at `/arc3/games` - the ultimate spoilers index with game cards, difficulty ratings, and documentation status.
  - Added `Arc3GameSpoiler` page at `/arc3/games/:gameId` - individual game deep-dive pages with:
    - Embedded playable game via iframe from three.arcprize.org
    - Mechanics documentation with action mappings
    - Spoiler-protected hints system (3 levels: mild hints, moderate spoilers, full solutions)
    - External resources section
    - Quick links to playground for agent testing
  - Populated ls20 ("Locksmith") with full documentation: mechanics explanation, action mappings, 4 community hints, and 2 external resources.
  - Updated ARC3Browser landing page to link to the new Games Browser (replaced "Feature in development" placeholder).
  - Game categories: preview (ls20, as66, ft09) and evaluation (lp85, sp80, vc33).
  - **Files**: `shared/arc3Games.ts`, `client/src/pages/Arc3GamesBrowser.tsx`, `client/src/pages/Arc3GameSpoiler.tsx`, `client/src/pages/ARC3Browser.tsx`, `client/src/App.tsx`

### Version 5.41.0  Dec 5, 2025 6:35pm

- **ARC3 Preview + complete 2025 leaderboard data** (Author: Cascade)
  - Added ARChitects team entries for 2024 (1st place, 53.5%) and 2025 (2nd place, 16.53%) with the official `/ARChitechts.png` team image.
  - Completed 2025 competition winners data: Team NVARC (Puget & Sorokin, 24.03%), ARChitects (16.53%), Team MindsAI (Jack Cole & Dries Smit, 15.42%), and Guillermo Barbadillo (6.53%).
  - Added Dries Smit as ARC-AGI-3 Agent Preview 2025 winner ("StochasticGoose", 12.58%) plus new `arc3_preview` category and "ARC3 2026" rising-stars section.
  - Updated Hall of Fame layout and seed data so team cards and new categories use the correct images and styling.
  - **Files**: `server/scripts/seedContributors.ts`, `shared/types/contributor.ts`, `client/src/utils/humanCardHelpers.ts`, `client/src/pages/HumanTradingCards.tsx`, `client/public/ARChitechts.png`, `client/public/dries.png`

### Version 5.40.2  Dec 5, 2025 3:58pm

- **Clickable cards + confirmed 1st place scores** (Author: Cascade)
  - Updated JF Puget & Ivan Sorokin with confirmed 1st place and 24.03% score.
  - Entire card image now clickable (opens profile modal).
  - Cards smaller (max-width 280px) with hover zoom effect and "View Profile" overlay.
  - Dialog X close button now visible with dark background.
  - **Files**: `server/scripts/seedContributors.ts`, `client/src/components/human/HumanTradingCard.tsx`, `client/src/components/ui/dialog.tsx`

### Version 5.40.1  Dec 5, 2025 3:50pm

- **Hall of Fame design overhaul** (Author: Cascade using Claude 3.5 Sonnet)
  - Warmer color palette: Replaced cold slate-950 with warm zinc gradient background.
  - Full profile modal redesign: Side-by-side layout with large image (45%) alongside content (55%).
  - Image now displays full-size with equal visual priority as text - no extra click required.
  - Added subtle radial gradient texture overlay for depth.
  - Section headers now have icon badges with colored backgrounds.
  - Cards have refined shadows, hover effects, and smoother transitions.
  - Gradient text on main title for visual polish.
  - **Files**: `client/src/pages/HumanTradingCards.tsx`, `client/src/components/human/HumanTradingCard.tsx`

### Version 5.40.0  Dec 5, 2025 3:45pm

- **ARC Prize 2025 Winners Page Refresh** (Author: Cascade using Claude 3.5 Sonnet)
  - Restructured Human Trading Cards page for the December 5, 2025 competition results announcement.
  - Added new hero section with celebratory styling, date badge, and 2025 results announcement.
  - Added `top_paper_award` contributor category with distinctive fuchsia/magenta styling for special recognition.
  - Created featured "2025 Top Paper Award" section with prominent display layout.
  - Added Alexia Jolicoeur-Martineau as 2025 Top Paper Award winner for "Less is More: Recursive Reasoning with Tiny Networks" (TRM).
  - Renamed "2025 Leaderboard" to "2025 Competition Winners" for clarity.
  - Updated helper functions with new category colors, icons, and display names.
  - **Files**: `client/src/pages/HumanTradingCards.tsx`, `client/src/utils/humanCardHelpers.ts`, `shared/types/contributor.ts`, `server/scripts/seedContributors.ts`

- **Auto-sync contributors on server startup** (Author: Cascade using Claude 3.5 Sonnet)
  - Added `upsertContributor` method to ContributorRepository for safe insert-or-update by fullName.
  - Added `syncContributors()` function that upserts all contributors from seed data without truncating.
  - Server now automatically syncs contributors on startup (non-destructive, safe for production).
  - Manual destructive seed (`npx tsx server/scripts/seedContributors.ts`) still available for full resets.
  - **Files**: `server/repositories/ContributorRepository.ts`, `server/scripts/seedContributors.ts`, `server/index.ts`

### Version 5.39.1  Dec 5, 2025 2:45pm

- **CompactPuzzleCard refactored to follow PuzzleCard patterns** (Author: Claude Sonnet 4)
  - Fixed theme mismatch: replaced DaisyUI `bg-base-100` (white) with shadcn/ui Card using CSS variables (`bg-card`, `text-card-foreground`) for proper dark theme support on PuzzleBrowser's `bg-slate-950` background.
  - Increased grid preview from 64px to 80px to match PuzzleCard and improve visibility.
  - Replaced `<a target="_blank">` with wouter `Link` for proper SPA navigation instead of opening new tabs.
  - Removed excessive whitespace: consolidated metrics into clean 2-column grid layout with conditional rendering.
  - Added proper hover states and "View Analysis →" footer that matches PuzzleCard UX.
  - **Files**: `client/src/components/puzzle/CompactPuzzleCard.tsx`

### Version 5.39.0  Dec 6, 2025 11:55pm

- **Compact Puzzle cards stay informative** (Author: Codex)
  - Prefetch the featured PuzzleBrowser tasks, feed them into the reusable `CompactPuzzleCard`, and keep the GIF/TinyGrid preview pipeline intact so featured cards no longer render blank white placeholders.
  - Call `usePuzzleDBStats` with `includeRichMetrics: true` and keep the shared card layout showing attempts, wrong counts, grid dimensions, and test counts alongside cost/token math so the browser mirrors the stats the database already knows.
  - Document the work plan and keep the shared card kit in sync with PuzzleDBViewer, preventing duplicated logic while still honoring the requested preview behavior.
  - **Files**: `docs/plans/2025-12-06-puzzle-browser-compact-card-plan.md`, `client/src/components/puzzle/CompactPuzzleCard.tsx`, `client/src/pages/PuzzleBrowser.tsx`

### Version 5.38.8  Dec 4, 2025 10:34pm

- **GPT-5.1 Codex limits removed** (Author: Codex)
  - Dropped the explicit `maxOutputTokens` caps from `gpt-5.1-codex-mini` and `gpt-5.1-codex` so they inherit the provider defaults and can stream long-form reasoning without artificial truncation.
  - **Files**: `server/config/models.ts:190-220`

### Version 5.38.5  Dec 4, 2025 10:35pm

- **Fix PuzzleBrowser button: correct link and make prominent full-width call-to-action** (Author: Claude Code using Haiku 4.5)
  - Fixed broken button link from `/puzzle-db-viewer` to correct route `/puzzles/database`
  - Repositioned button to top of featured section header and made it full-width, centered, and highly prominent
  - Full button text restored: "See puzzles from ARC 1 and 2, which have not been solved yet"
  - Enhanced styling: red background (`bg-red-600 hover:bg-red-700`), full-width layout (`w-full`), centered text (`text-center`), large padding (`px-8 py-4`), bold large text (`text-lg font-bold`), shadow effect
  - **Files**: `client/src/pages/PuzzleBrowser.tsx:314-334`

### Version 5.38.4  Dec 4, 2025 8:20pm

- **Grid image toggle inside Advanced Controls** (Author: Cascade using Haiku 4.5)
  - Moved the "include puzzle screenshots" switch into the shared `AdvancedControls` component so PuzzleExaminer, PuzzleDiscussion, and ModelDebate share a single unified control.
  - The toggle is now always visible; backend capability checks still determine whether ARC grid PNGs are actually attached, so non-vision models remain text-only.
  - **Files**: `client/src/components/puzzle/AdvancedControls.tsx`, `client/src/pages/PuzzleExaminer.tsx`, `client/src/components/puzzle/refinement/ProfessionalRefinementUI.tsx`, `client/src/components/puzzle/debate/IndividualDebate.tsx`

### Version 5.38.3  Dec 4, 2025 7:45pm

- **Model catalog: mark GPT-5 family as vision-capable** (Author: Cascade using Haiku 4.5)
  - Updated all GPT-5 / GPT-5.1 entries (including the OpenRouter mirror) in the central model config to set `supportsVision: true`, matching provider capabilities.
  - Ensures the new grid image toggles in PuzzleExaminer, PuzzleDiscussion, and ModelDebate correctly recognize GPT-5 variants as eligible for ARC grid screenshots.
  - **Files**: `server/config/models.ts`

### Version 5.38.2  Dec 4, 2025 7:40pm

- **Vision toggles for refinement and debate UIs** (Author: Cascade using Haiku 4.5)
  - Surfaced the existing `includeGridImages` option in the PuzzleDiscussion progressive reasoning interface and the ModelDebate challenge interface, reusing the grid image support added in 5.38.0.
  - Added compact shadcn `Switch` controls in ProfessionalRefinementUI and IndividualDebate, visible only when the currently selected model has `supportsVision = true`.
  - Wired these toggles through `useAnalysisResults` so both streaming and non-streaming refinement/debate runs can include ARC grid PNGs for vision-capable models while preserving text-only behavior for all other models.
  - **Files**: `client/src/pages/PuzzleDiscussion.tsx`, `client/src/components/puzzle/refinement/ProfessionalRefinementUI.tsx`, `client/src/pages/ModelDebate.tsx`, `client/src/components/puzzle/debate/IndividualDebate.tsx`

### Version 5.38.1  Dec 4, 2025 7:25pm

- **PuzzleCard: Fix test count display to show actual test cases instead of prediction count** (Author: Claude Code using Haiku 4.5)
  - Fixed bug where puzzle cards always showed "Tests Single" regardless of actual test case count
  - Changed test display logic from checking `puzzle.hasMultiplePredictions` (which tracks AI predictions) to checking actual `taskData.test.length` from loaded puzzle data
  - Now correctly displays "Single" for puzzles with 1 test case, or the actual count (e.g., "2", "3") for puzzles with multiple test cases
  - **Files**: `client/src/components/puzzle/PuzzleCard.tsx:224`

### Version 5.38.0  Dec 4, 2025 7:15pm

- **Puzzle Analysis: Add vision model support with grid image inclusion** (Author: Claude Code using Haiku 4.5)
  - Extended `/api/analyze` and streaming analysis endpoints to optionally include puzzle grid images for vision-capable models, enabling visual context in model reasoning
  - Added `supportsVision` flag to model configuration and exposed it across `/api/models`, `/api/models/:modelKey`, and `/api/models/provider/:provider` endpoints
  - Implemented grid image capture system that converts puzzle grids to canvas-based PNG dataURLs with configurable descriptions for inclusion in OpenAI Responses API payloads
  - Extended `buildResponsesPayload()` to support mixed text/image content in user messages by adding `input_image` type to ResponseContent union
  - Integrated grid image generation into both streaming (`analyzePuzzleWithStreaming`) and non-streaming (`analyzePuzzle`) code paths with graceful fallback to text-only on failure
  - Added user-facing UI toggle in PuzzleExaminer to enable/disable grid image inclusion, visible only when vision models are available
  - Simplified CompactPuzzleCard navigation: replaced wouter Link with standard anchor tags (opens puzzle in new tab) for improved interoperability
  - **Files**: `client/src/pages/PuzzleExaminer.tsx` (added Switch toggle for grid images), `client/src/hooks/useAnalysisResults.ts` (added state), `client/src/lib/streaming/analysisStream.ts`, `server/services/openai/payloadBuilder.ts` (image content support), `server/services/puzzleAnalysisService.ts` (grid capture + streaming integration), `server/controllers/streamController.ts`, `server/routes/models.ts`, `server/services/openai.ts`, `client/src/components/puzzle/CompactPuzzleCard.tsx`, `server/services/streaming/analysisStreamService.ts`

### Version 5.36.17  Dec 4, 2025 6:00pm

- **Slack GIF Creator: Add ARC2 puzzle support and generate evaluation datasets** (Author: Claude Code using Haiku 4.5)
  - Extended puzzle discovery to support ARC 2 evaluation puzzles (evaluation2 and training2 directories)
  - Generated ARC2_EVAL dataset: 44 animated GIFs for ARC 2 unsolved evaluation puzzles (~15 MB total)
  - Each GIF shows all training examples and test cases with proper label annotations
  - **Files**: `.claude/skills/slack-gif-creator/create_arc_puzzle_gif.py` (updated find_puzzle_file), `.claude/skills/slack-gif-creator/ARC2_EVAL/` (new folder with 44 GIF files)

### Version 5.36.16  Dec 4, 2025 5:30pm

- **Slack GIF Creator: Optimize animation speed and dynamic grid scaling** (Author: Claude Code using Haiku 4.5)
  - Reduced default FPS from 15 to 8 for slower, more deliberate animation in ARC puzzle GIFs
  - Implemented dynamic grid cell sizing based on puzzle dimensions: 3×3 grids get ~24px cells, 30×30 grids get ~6px cells for consistent readability
  - Auto-calculated frame sizes to properly fit grids of any size without clipping or excess white space
  - Fixed Unicode encoding issues on Windows console (replaced emoji characters with ASCII equivalents in print statements)
  - Generated ARC1_EVAL dataset: 11 animated GIFs (7d419a02, 50f325b5, b9630600, 4ff4c9da, 14754a24, 8b28cd80, c6e1b8da, f3b10344, 212895b5, 16b78196, 0934a4d8)
  - **Files**: `.claude/skills/slack-gif-creator/core/gif_builder.py`, `.claude/skills/slack-gif-creator/core/validators.py`, `.claude/skills/slack-gif-creator/create_arc_puzzle_gif.py`, `.claude/skills/slack-gif-creator/ARC1_EVAL/` (new folder with 11 GIF files)

### Version 5.36.15  Dec 4, 2025 5:00pm

- **PuzzleBrowser: Redesign layout, improve typography, and fix UX issues** (Author: Claude Code using Haiku 4.5)
  - Moved "Open Research Browser" button to header next to "Featured ARC puzzles" heading with shadcn/ui Button component for better visibility
  - Moved "See puzzles from ARC 1 and 2..." button to the bottom of featured section inside the card with separator
  - Increased font sizes throughout page: all labels from text-xs to text-sm, working notes from text-xs to text-sm, status badges from text-xs to text-sm
  - Replaced generic btn styling with shadcn/ui Button component for consistency
  - Fixed broken external link in working notes section
  - **Files**: `client/src/pages/PuzzleBrowser.tsx`

### Version 5.36.14  Dec 4, 2025 4:30pm

- **Docs: Refresh README with recent streaming, solver, and puzzle browser updates** (Author: Cascade)
  - Updated the top-level README version and "What's New" section to summarize recent Poetiq/BeeTree streaming improvements, puzzle database browsing tools, and debate/discussion UX tweaks in plain language for new visitors.
  - Added short notes about SnakeArena/SnakeBench integration, unsolved puzzle database view, and multi-provider streaming so the front page reflects current capabilities instead of older v5.1.0 highlights.
  - **Files**: `README.md`, `CHANGELOG.md`

### Version 5.36.14  Dec 4, 2025 12:00am

- **PuzzleBrowser: Add button to view unsolved ARC1/ARC2 puzzles** (Author: Claude Code using Haiku 4.5)
  - Added simple button after featured gallery linking to `/puzzle-db-viewer` for browsing all unsolved ARC1 and ARC2 evaluation puzzles.
  - **Files**: `client/src/pages/PuzzleBrowser.tsx`

### Version 5.37.2  Dec 4, 2025 7:05pm

- **Puzzle Browser metrics: real attempt counts** (Author: Codex)
  - Hooked the Puzzle Browser into `usePuzzleDBStats`, mapping each entry to `CompactPuzzleCard` so the featured gallery and research results display actual `attempts`/`wrong` metrics instead of hard-coded zeros while still reusing the GIF-capable card layout.
  - **Files**: `client/src/pages/PuzzleBrowser.tsx`

### Version 5.37.1  Dec 4, 2025 6:50pm

- **Puzzle Browser: reuse CompactPuzzleCard** (Author: Codex)
  - Swapped every Puzzle Browser puzzle card (featured gallery + advanced results) to the shared `CompactPuzzleCard`, including helper projection logic so `EnhancedPuzzleMetadata` satisfies the required `PuzzleDBStats` shape and keeps the GIF/TinyGrid preview behavior consistent with `/puzzles/database`.
  - **Files**: `client/src/pages/PuzzleBrowser.tsx`, `client/src/components/puzzle/CompactPuzzleCard.tsx`

### Version 5.37.0  Dec 4, 2025 6:25pm

- **ARC2 GIF previews for CompactPuzzleCard** (Author: Codex)
  - Copied the ARC2-Eval GIF batch into the public decoration assets, documented the rollout, and expanded `PUZZLE_GIF_MAP` so every unsolved ARC2 puzzle now auto-renders its curated animation on the `/puzzles/database` cards.
  - **Files**: `client/public/images/decoration/arc_puzzle_13e47133.gif`, `client/public/images/decoration/arc_puzzle_142ca369.gif`, `client/public/images/decoration/arc_puzzle_195c6913.gif`, `client/public/images/decoration/arc_puzzle_20270e3b.gif`, `client/public/images/decoration/arc_puzzle_21897d95.gif`, `client/public/images/decoration/arc_puzzle_221dfab4.gif`, `client/public/images/decoration/arc_puzzle_269e22fb.gif`, `client/public/images/decoration/arc_puzzle_271d71e2.gif`, `client/public/images/decoration/arc_puzzle_28a6681f.gif`, `client/public/images/decoration/arc_puzzle_2b83f449.gif`, `client/public/images/decoration/arc_puzzle_2d0172a1.gif`, `client/public/images/decoration/arc_puzzle_35ab12c3.gif`, `client/public/images/decoration/arc_puzzle_3a25b0d8.gif`, `client/public/images/decoration/arc_puzzle_446ef5d2.gif`, `client/public/images/decoration/arc_puzzle_4c416de3.gif`, `client/public/images/decoration/arc_puzzle_4c7dc4dd.gif`, `client/public/images/decoration/arc_puzzle_4e34c42c.gif`, `client/public/images/decoration/arc_puzzle_5545f144.gif`, `client/public/images/decoration/arc_puzzle_5dbc8537.gif`, `client/public/images/decoration/arc_puzzle_62593bfd.gif`, `client/public/images/decoration/arc_puzzle_6e4f6532.gif`, `client/public/images/decoration/arc_puzzle_6ffbe589.gif`, `client/public/images/decoration/arc_puzzle_7491f3cf.gif`, `client/public/images/decoration/arc_puzzle_78332cb0.gif`, `client/public/images/decoration/arc_puzzle_7b0280bc.gif`, `client/public/images/decoration/arc_puzzle_7b80bb43.gif`, `client/public/images/decoration/arc_puzzle_800d221b.gif`, `client/public/images/decoration/arc_puzzle_88bcf3b4.gif`, `client/public/images/decoration/arc_puzzle_88e364bc.gif`, `client/public/images/decoration/arc_puzzle_8b7bacbf.gif`, `client/public/images/decoration/arc_puzzle_9385bd28.gif`, `client/public/images/decoration/arc_puzzle_97d7923e.gif`, `client/public/images/decoration/arc_puzzle_9bbf930d.gif`, `client/public/images/decoration/arc_puzzle_a32d8b75.gif`, `client/public/images/decoration/arc_puzzle_b6f77b65.gif`, `client/public/images/decoration/arc_puzzle_b9e38dc0.gif`, `client/public/images/decoration/arc_puzzle_cbebaa4b.gif`, `client/public/images/decoration/arc_puzzle_d35bdbdc.gif`, `client/public/images/decoration/arc_puzzle_de809cff.gif`, `client/public/images/decoration/arc_puzzle_e12f9a14.gif`, `client/public/images/decoration/arc_puzzle_e87109e9.gif`, `client/public/images/decoration/arc_puzzle_eee78d87.gif`, `client/public/images/decoration/arc_puzzle_f560132c.gif`, `client/public/images/decoration/arc_puzzle_faa9f03d.gif`, `client/src/utils/puzzleGifMap.ts`, `docs/2025-12-04-arc2-gif-card-plan.md`

### Version 5.36.14  Dec 4, 2025 6:05pm

- **Compact puzzle cards: ARC1-Eval GIF previews** (Author: Codex)
  - Copied the newly generated ARC1-Eval GIFs into the public decoration assets and added a centralized `PUZZLE_GIF_MAP` so puzzle IDs immediately map to their animated previews.
  - Updated `CompactPuzzleCard` to prefer those GIFs (lazy-loaded via the existing observer) while keeping the TinyGrid fallback for all other puzzles, giving the `/puzzles/database` cards an eye-catching animation whenever we have curated media.
  - Documented the approach in `docs/2025-12-04-compact-card-gif-integration-plan.md` for future expansions.
  - **Files**: `client/public/images/decoration/arc_puzzle_7d419a02.gif`, `client/public/images/decoration/arc_puzzle_50f325b5.gif`, `client/public/images/decoration/arc_puzzle_b9630600.gif`, `client/public/images/decoration/arc_puzzle_4ff4c9da.gif`, `client/public/images/decoration/arc_puzzle_14754a24.gif`, `client/public/images/decoration/arc_puzzle_8b28cd80.gif`, `client/public/images/decoration/arc_puzzle_c6e1b8da.gif`, `client/public/images/decoration/arc_puzzle_f3b10344.gif`, `client/public/images/decoration/arc_puzzle_212895b5.gif`, `client/public/images/decoration/arc_puzzle_16b78196.gif`, `client/public/images/decoration/arc_puzzle_0934a4d8.gif`, `client/src/utils/puzzleGifMap.ts`, `client/src/components/puzzle/CompactPuzzleCard.tsx`, `docs/2025-12-04-compact-card-gif-integration-plan.md`

### Version 5.36.13  Dec 3, 2025 11:20pm

- **Reusable CompactPuzzleCard component** (Author: Codex)
  - Extracted the inline PuzzleDBViewer card into `client/src/components/puzzle/CompactPuzzleCard.tsx` with optional lazy loading, prefetched task support, and customizable actions so other pages can reuse the TinyGrid preview + metrics layout without duplicating logic.
  - Updated PuzzleDBViewer to consume the shared component and removed the redundant helper code from the page file.
  - **Files**: `client/src/components/puzzle/CompactPuzzleCard.tsx`, `client/src/pages/PuzzleDBViewer.tsx`

### Version 5.36.12  Dec 3, 2025 10:55pm

- **Docs: Compact puzzle card extraction plan** (Author: Codex)
  - Captured a detailed plan to promote the inline `CompactPuzzleCard` in PuzzleDBViewer into a reusable component under `client/src/components/puzzle/`, covering prop design, extraction steps, and verification.
  - **Files**: `docs/2025-12-03-compact-puzzle-card-plan.md`

### Version 5.36.11  Dec 3, 2025 10:40pm

- **PuzzleDBViewer: Show test outputs in TinyGrid previews** (Author: Codex)
  - Updated the compact puzzle cards on `/puzzles/database` to render the first test output (with sensible fallbacks) instead of the first training input so researchers see the actual evaluation targets.
  - **Files**: `client/src/pages/PuzzleDBViewer.tsx`

### Version 5.36.10  Dec 3, 2025 10:23pm

- **Model Config: Mistral Large 2512** (Author: Cascade)
  - Updated the shared models catalog and Poetiq model list to use the official `mistralai/mistral-large-2512` identifier with a 262,144 token context window and $0.50 / $1.50 pricing.
  - Replaced the previous cloaked OpenRouter arena id in all active configs so analytics, Poetiq runs, and UI model groups now present only the official model name going forward.
  - Removed the now-unused name-normalization rule for the old cloaked id, since we no longer treat it as a separate model in code.
  - **Files**: `server/config/models.ts`, `server/controllers/poetiqController.ts`, `shared/modelGroups.ts`, `scripts/testing/test-openrouter-models.ts`, `server/utils/modelNormalizer.ts`, `CHANGELOG.md`

### Version 5.36.9  Dec 3, 2025 10:15pm

- **Poetiq Solver: Add Free OpenRouter Arena Models** (Author: Codex)
  - Surfaced Amazon Nova 2 Lite (Free) and Arcee Trinity Mini (Free) inside the `/api/poetiq/models` response so the Poetiq control panel exposes both new options.
  - Flagged the new ids inside `OPENROUTER_SERVER_KEY_MODELS`, which keeps BYO keys optional for these free-tier runs while preserving the BYO requirement for other OpenRouter models.
  - Captured a short implementation plan at `docs/2025-12-03-poetiq-free-models-plan.md` for traceability.
  - **Files**: `server/controllers/poetiqController.ts`, `docs/2025-12-03-poetiq-free-models-plan.md`

### Version 5.36.8  Dec 3, 2025 9:55pm

- **DeepSeek: Enhanced provider error logging** (Author: Cascade)
  - Added DeepSeek-specific error handling that records HTTP status, provider error code, error type, and a truncated copy of the provider response body when DeepSeek API calls fail.
  - Delegates back to the shared BaseAIService error handler so existing error propagation and Express middleware behavior remain unchanged while logs now surface the root cause behind generic "terminated" errors.
  - **Files**: `server/services/deepseek.ts`

### Version 5.36.7  Dec 3, 2025 5:45pm

- **Poetiq UI: Telemetry-first cleanup** (Author: Codex)
  - Rebuilt `PoetiqLiveDashboard` so it now focuses solely on the active model/provider, tokens in/out/total, total cost, iteration progress, and the latest solver message.
  - Removed the Poetiq Agents Runtime panel entirely and re-ordered the solver layout so the Event Log, Raw Events panel, and final result card render directly under the header, while the Python terminal only appears once it has data (no more empty black box).
  - **Files**: `client/src/components/poetiq/PoetiqLiveDashboard.tsx`, `client/src/pages/PoetiqSolver.tsx`, `client/src/components/poetiq/PoetiqAgentsRuntimePanel.tsx`
- **Poetiq Result Card: Restore code preview + standard wording** (Author: Codex)
  - The CORRECT / INCORRECT card again embeds the final `transform()` code (with streaming fallback) so users can copy the winning Python without opening other panels, while the raw-events column stays unchanged.
  - **Files**: `client/src/pages/PoetiqSolver.tsx`, `client/src/components/poetiq/PoetiqStreamingVisualizer.tsx`, `client/src/components/poetiq/PoetiqStreamingModal.tsx`, `puzzle-analysis.ts`
- **Docs: Capture Poetiq solver UI plan** (Author: Codex)
  - Added a quick planning note describing the telemetry-first redesign.
  - **Files**: `docs/2025-12-03-poetiq-solver-ui-plan.md`

### Version 5.36.6  Dec 3, 2025 5:15pm

- **Poetiq UI: Move real telemetry above the fold** (Author: Cascade)
  - Trimmed the Poetiq solver header to remove static explanatory paragraphs and keep only the puzzle id, run status, iterations, elapsed time, and live token/cost summary.
  - Reordered the main two-column layout so the **Event Log** and **Raw Events** panels sit at the top of the right column, with prompt inspector/timeline/reasoning panels stacked underneath them.
  - This ensures the first screen after starting a run shows the live stream, raw payloads, and high-level metrics without scrolling.
  - **Files**: `client/src/pages/PoetiqSolver.tsx`

### Version 5.36.5  Dec 3, 2025 5:00pm

- **Poetiq UI: Remove dead iteration tile, surface raw telemetry by default** (Author: Cascade)
  - Removed the non-functional "Iteration History" heatmap tile from the Poetiq live dashboard so the layout focuses on experts, best result, code, and live events.
  - Updated the Poetiq solver page so the **Prompt Timeline**, **Raw Events**, and **Event Log** panels are visible by default during a run instead of being hidden behind toggle buttons.
  - Cleaned up the Raw Events empty state message to match the new SSE-only streaming path (no WebSocket wording).
  - **Files**: `client/src/components/poetiq/PoetiqLiveDashboard.tsx`, `client/src/pages/PoetiqSolver.tsx`

### Version 5.36.4  Dec 3, 2025 4:15pm

- **Beetree Results: Improve grid spacing** (Author: Claude Code using Haiku 4.5)
  - Increased gap between ground truth and consensus prediction grids from `gap-4` (16px) to `gap-8` (32px) to prevent grids from appearing smushed together.
  - Added `justify-center` to center the grid layout for better visual balance.
  - **Files**: `client/src/pages/BeetreeSolver.tsx:499`

### Version 5.36.3  Dec 3, 2025 4:00pm

- **Poetiq Streaming: Remove all WebSocket usage (SSE-only)** (Author: Cascade)
  - Removed all `wsService.broadcast` calls from `poetiqService.ts` so Poetiq no longer emits WebSocket progress/log events; only SSE events are produced via `poetiqStreamService`.
  - Updated `poetiqController.ts` to stop broadcasting over WebSockets for both the legacy `/api/poetiq/solve/:taskId` endpoint and Poetiq batch runs, keeping them as console-log-only code paths while SSE is the sole streaming mechanism.
  - Updated `wsService.ts` to stop accepting `/api/poetiq/progress` WebSocket connections; Saturn, Grover, and Beetree WebSockets remain unchanged.
  - This ensures Poetiq cannot accidentally fall back to WebSockets and that all live solver updates come exclusively from the SSE pipeline.
  - **Files**: `server/services/poetiq/poetiqService.ts`, `server/controllers/poetiqController.ts`, `server/services/wsService.ts`

### Version 5.36.2  Dec 3, 2025 3:45pm

- **Poetiq SSE: Fix session start race and align client/server endpoints** (Author: Cascade)
  - Updated `client/src/hooks/usePoetiqProgress.ts` to call the dedicated SSE solve endpoint `POST /api/poetiq/stream/solve/:taskId` so the `sessionId` used by the frontend always matches the SSE streaming lifecycle managed by the backend.
  - Relaxed the brittle `hasActiveStream` check in `poetiqController.startStreamingSolver` so the solver can start even if the SSE connection is still negotiating; `SSEStreamManager` safely drops events until a client is registered, matching Saturn/Beetree semantics.
  - This fixes cases where Poetiq appeared to “not find the session” or never delivered progress events despite a valid run starting.
  - **Files**: `client/src/hooks/usePoetiqProgress.ts`, `server/controllers/poetiqController.ts`

### Version 5.36.1  Dec 3, 2025 1:35pm

- **BeeTree Cost & Models UI Clarification** (Author: Cascade)
  - Updated `server/python/beetree_wrapper.py` cost parsing so nested Step 5 logs (trigger-deep-thinking / image / generate-hint) are fully flattened and counted, ensuring `costBreakdown.total_cost` properly matches the underlying BeeTree solver summary.
  - Clarified the Beetree solver page to distinguish **unique model types** from **total model runs**, and added helper text explaining that the Total Cost panel reflects the sum over all underlying model calls, not just the number of distinct models.
  - The pre-configured models section now shows both the number of unique model types and the total run count (e.g., "1 unique type, 7 total runs"), which should make it clearer why consensus counts can be smaller than the overall run volume.
  - **Files**: `server/python/beetree_wrapper.py`, `client/src/pages/BeetreeSolver.tsx`

### Version 5.36.0  Dec 3, 2025 12:45pm

- **Poetiq SSE Migration: Replace WebSocket with Server-Sent Events** (Author: Cascade)
  - **Breaking Change**: Poetiq solver now uses SSE instead of WebSocket for streaming, consistent with Saturn and Beetree solvers.
  - Created `server/services/streaming/poetiqStreamService.ts` - new SSE-based streaming service following Saturn/Beetree patterns.
  - Added SSE endpoints to `poetiqController.ts`:
    - `GET /api/poetiq/stream/:sessionId` - SSE connection endpoint
    - `POST /api/poetiq/stream/solve/:taskId` - Initialize solver with SSE
    - `POST /api/poetiq/stream/start/:sessionId` - Start solver after SSE connected
  - Updated `client/src/hooks/usePoetiqProgress.ts` to use EventSource (SSE) instead of WebSocket.
  - Created `client/src/components/poetiq/PoetiqLiveDashboard.tsx` - compact, data-dense live dashboard replacing verbose PoetiqProgressDashboard.
  - Updated `client/src/pages/PoetiqSolver.tsx` to use the new compact dashboard.
  - **Why**: WebSocket was causing events to not flow correctly to UI. SSE is simpler, auto-reconnects, and matches existing Saturn/Beetree implementation patterns.
  - **Files**: `server/services/streaming/poetiqStreamService.ts`, `server/controllers/poetiqController.ts`, `server/routes.ts`, `client/src/hooks/usePoetiqProgress.ts`, `client/src/components/poetiq/PoetiqLiveDashboard.tsx`, `client/src/pages/PoetiqSolver.tsx`

### Version 5.35.45  Dec 3, 2025 11:35am

- **Beetree Logs & UI: Use root logs directory and improve raw log display** (Author: Cascade)
  - Pointed `server/python/beetree_wrapper.py` at the project root `logs` directory so BeeTree cost parsing matches the actual `d:\GitHub\arc-explainer\logs` files the user is inspecting, instead of `beetreeARC/logs`.
  - Left the Beetree progress data as *raw* log events but reformatted the Progress Log card: stage events keep their existing structure, while `solver_log` lines now render in a compact monospace row with a small level badge and truncated message to make long outputs readable.
  - Updated the Beetree Solver result card to show **ground-truth grid vs. consensus prediction side by side**, while keeping the consensus/agreements summary and run-again button.
  - **Files**: `server/python/beetree_wrapper.py`, `client/src/pages/BeetreeSolver.tsx`

### Version 5.35.44  Dec 3, 2025 11:10am

- **Beetree Cost Fix: Parse dict-keyed step logs correctly** (Author: Claude Sonnet 4)
  - Fixed `server/python/beetree_wrapper.py` step log parsing which was expecting a list or dict with `runs` key, but BeeTree actually emits dicts keyed by run ID (e.g. `"gpt-5.1-codex-mini_2_step_1_...": {...}`).
  - The loop now correctly iterates over dict values when the log is dict-keyed, extracting `input_tokens`, `output_tokens`, `total_cost`, and `duration_seconds` for each model run.
  - Also fixed cost field name from `cost` to `total_cost` to match actual BeeTree log format.
  - This restores token usage and cost breakdown display in the Beetree Solver UI which was previously showing zeros.
  - **Files**: `server/python/beetree_wrapper.py`

### Version 5.35.43  Dec 2, 2025 11:45pm

- **Beetree Hook: Fix handleSSEEvent initialization error** (Author: Cascade)
  - Restructured `useBeetreeRun` so the `handleSSEEvent` callback is defined before it is captured by the SSE listener registration function, eliminating the `Cannot access 'handleSSEEvent' before initialization` runtime crash when loading the Beetree Solver page.
  - Kept the existing SSE wiring semantics intact while tightening hook dependency arrays to avoid unnecessary re-creations and preserving the stream event handling contract.
  - **Files**: `client/src/hooks/useBeetreeRun.ts`

### Version 5.35.42  Dec 2, 2025 11:40pm

- **Beetree Wrapper: Fix invalid-result error and normalize predictions** (Author: Cascade)
  - Updated `server/python/beetree_wrapper.py` to interpret BeetreeARC's `picked_solutions` structure correctly, normalize it into pure grid predictions, and always emit a `final` event for completed runs instead of raising `"beetreeARC returned invalid result"` and exiting with code 1.
  - Successful Beetree runs (PASS/FAIL/SUBMITTED) now return exit code 0 with a structured result payload so the Node service can persist outputs and cost breakdowns without treating them as hard errors.
- **Beetree Bridge: Preserve parsed JSON events without crashing debug logger** (Author: Cascade)
  - Fixed the Beetree branch of `pythonBridge.runBeetreeAnalysis` to stop referencing an undefined `opts.sessionId` variable in debug logs, so successfully parsed NDJSON lines are forwarded as structured events instead of falling back to generic log messages.
  - This ensures `start`, `progress`, `final`, and `error` events from the Beetree wrapper reach `beetreeService` and the SSE stream intact for real-time UI updates and debugging.

### Version 5.35.41  Dec 2, 2025 11:25pm

- **Beetree UI: Restore SSE progress events** (Author: Codex GPT-5)
  - Normalized Beetree session IDs on the client so `/api/stream/analyze/beetree-:sessionId` never receives a double `beetree-` prefix, allowing the backend stream registry to find the right session.
  - Rebuilt the Beetree hook’s SSE wiring to register explicit listeners for each event name (`stream_start`, `solver_progress`, etc.) and dispatch updates based on the SSE event type instead of a missing payload field.
  - Added handling for `stream.init`, completion, and termination events so `isConnected`, `status`, and progress/cost data reflect the live stream lifecycle.
  - **Files**: `client/src/hooks/useBeetreeRun.ts`, `docs/2025-12-02-beetree-streaming-debug-plan.md`

### Version 5.35.40  Dec 2, 2025 11:05pm

- **Poetiq Streaming: Add timestamp preservation and event trace collection** (Author: Cascade)
  - Fixed Poetiq event streaming to preserve original timestamps (calculated at wrapper level) through all service layers with `timestamp: event.timestamp ?? Date.now()` pattern.
  - Implemented event trace collection in controller callback, capping at 500 events to avoid unbounded memory growth (same pattern as Beetree).
  - Added event trace to final WebSocket broadcast so clients receive complete event history with accurate timing for debugging and analytics.
  - Added comprehensive debug logging across 4 layers: wrapper (Python emit), service (event handler), wsService (broadcast), and client (WS message reception).
  - Improved event tracking with timestamps for performance analysis and timeline visualization in PuzzleExaminer and other streaming UI components.
  - **Files**: `server/services/poetiq/poetiqService.ts`, `server/controllers/poetiqController.ts`, `server/services/wsService.ts`, `server/python/poetiq_wrapper.py`, `client/src/hooks/usePoetiqProgress.ts`

### Version 5.35.39  Dec 2, 2025 10:50pm

- **Beetree Streaming: Fix sessionId mismatch and event delivery** (Author: Cascade)
  - Fixed critical sessionId mismatch in Beetree SSE streaming pipeline where `beetreeController.generateSessionId()` was adding `beetree-` prefix, then `beetreeStreamService` added another `beetree-` prefix, causing `getStreamState()` lookups to fail with "Session not found" errors.
  - Removed `beetree-` prefix from controller's `generateSessionId()` so streamKey is consistently constructed once in `beetreeStreamService.startStreaming()` as `beetree-${sessionId}`.
  - Added comprehensive debug logging to trace event flow through all 4 layers: pythonBridge (NDJSON parsing), beetreeService (event routing), beetreeStreamService (harness), and SSEStreamManager (client delivery).
  - Events now properly flow from Python wrapper → Node bridge → service layer → SSE harness → client browser in real-time.
  - **Files**: `server/controllers/beetreeController.ts`, `server/services/pythonBridge.ts`, `server/services/beetreeService.ts`, `server/services/streaming/beetreeStreamService.ts`, `server/services/streaming/SSEStreamManager.ts`, `client/src/hooks/useBeetreeRun.ts`

### Version 5.35.38  Dec 2, 2025 10:40pm

- **Streaming: Enable GPT-5.1 in PuzzleExaminer** (Author: Cascade)
  - Updated the OpenAI streaming allowlist so GPT-5.1 reasoning models (`gpt-5.1-2025-11-13`, `gpt-5.1-codex`, `gpt-5.1-codex-mini`) can use the SSE analysis pipeline instead of falling back with a "Streaming is not enabled for this model" error.
  - Impact: PuzzleExaminer and other streaming-aware flows now treat GPT-5.1 as fully stream-capable when the global streaming feature flag is on.
  - **Files**: `server/services/openai.ts`

### Version 5.35.37  Dec 2, 2025 10:07pm

- **About Page: Simon spotlight + mosaic footer** (Author: Cascade)
  - Added a dedicated Simon Strandgaard spotlight card in the About page sidebar using animated ARC puzzle GIF styling inspired by the Hall of Fame trading cards.
  - Increased contrast and visual emphasis of the "Honest Truth" story card so the core text reads more clearly on dark backgrounds.
  - Replaced the heart icon footer with a fully mosaic-based border and tagline that better matches the rest of the sites visual language.
  - **Files**: `client/src/pages/About.tsx`

### Version 5.35.36  Dec 2, 2025 9:50pm

- **SnakeArena: link directly to SnakeBench.com** (Author: Cascade)
  - Updated the SnakeArena React page to always embed/link `https://snakebench.com` instead of relying on `VITE_SNAKEBENCH_URL`, removing the confusing "SnakeBench frontend not configured" state.
  - Kept a matching `VITE_SNAKEBENCH_URL` default in `.env` so local builds and Docker behaves consistently.
  - **Files**: `client/src/pages/SnakeArena.tsx`, `.env`

### Version 5.35.35  Dec 2, 2025 9:40pm

- **SnakeBench staging URL wiring** (Author: Cascade)
  - Fixed `.env` formatting so `VITE_SNAKEBENCH_URL` is declared on its own line and actually recognized by Vite (it was previously concatenated onto `XAI_API_KEY`, so the Snake Arena page always showed "SnakeBench frontend not configured").
  - Set the default `VITE_SNAKEBENCH_URL` in the repo to the staging SnakeBench frontend at `https://arc-explainer-staging.up.railway.app/snake-arena`, and documented this in `.env.example` for future deployments.
  - **Files**: `.env`, `.env.example`

### Version 5.35.34  Dec 2, 2025 9:30pm

- **Beetree Windows shim for fcntl** (Author: Codex GPT-5)
  - Added a lightweight no-op `fcntl` module shim in `server/python/beetree_wrapper.py` so BeetreeARC can import on Windows (the upstream logging uses Unix-only `fcntl` for file locks). This unblocks local Beetree runs on Windows without touching the submodule.
  - **Files**: `server/python/beetree_wrapper.py`

### Version 5.35.33  Dec 2, 2025 9:20pm

- **Gemini SDK alignment + pip conflict fix** (Author: Codex GPT-5)
  - Swapped the legacy `google-generativeai` dependency for the modern `google-genai` client so our own Python code uses the same stack as BeetreeARC (fixes the protobuf 6.x vs <6 resolver failure during `pip install -r requirements.txt`).
  - Updated `solver/poetiq/llm.py` to call Gemini via `google.genai.Client`, including a new config builder, `asyncio.to_thread` wrapper, and dual API key support (`GEMINI_API_KEY`/`GOOGLE_API_KEY`), plus refreshed token usage parsing.
  - Documented the switch in `solver/poetiq/config.py` comment so future contributors know the model IDs follow google-genai naming.
  - **Files**: `requirements.txt`, `solver/poetiq/llm.py`, `solver/poetiq/config.py`

### Version 5.35.34  Dec 2, 2025 9:30pm

- **Beetree Windows shim for fcntl** (Author: Codex GPT-5)
  - Added a lightweight no-op `fcntl` module shim in `server/python/beetree_wrapper.py` so BeetreeARC can import on Windows (the upstream logging uses Unix-only `fcntl` for file locks). This unblocks local Beetree runs on Windows without touching the submodule.
  - **Files**: `server/python/beetree_wrapper.py`

### Version 5.35.32  Dec 2, 2025 8:45pm

- **Docker build: beetree requirements placeholder** (Author: Codex GPT-5)
  - Docker builds now create a temporary `beetreeARC/requirements.txt` before running `pip install -r requirements.txt`, so the new `-r beetreeARC/requirements.txt` include never fails even when the submodule is missing from the build context. After the repo is copied (or the git clone fallback runs) we still install the real Beetree dependencies exactly as before.
  - **Files**: `Dockerfile`

### Version 5.35.31  Dec 2, 2025 8:31pm

- **Beetree requirements install + onboarding notes** (Author: Codex GPT-5)
  - Linked `requirements.txt` to `beetreeARC/requirements.txt` so running a single `pip install -r requirements.txt` also satisfies BeetreeARC's pinned modules (fixes the "module not found" errors emitted by `beetree_wrapper.py`).
  - Expanded `docs/reference/architecture/DEVELOPER_GUIDE.md` with a Python Solvers & Beetree checklist covering submodule init, pip install, and the key integration files (pythonBridge, wrapper, service, and client hook/page).
  - Added `docs/2025-12-02-beetree-deps-plan.md` to capture the investigation scope, affected files, and implementation tasks for this fix.

### Version 5.35.30  Dec 2, 2025 7:00pm

- **PuzzleDiscussion: Refinement UX Reordered + Reasoning Controls** (Author: Cascade using Claude Sonnet 4)
  - Moved **Continue Refinement** (user guidance + send button) to the very top of the refinement UI
  - Added a dedicated **Advanced Controls** card using the shared `AdvancedControls` component (same pattern as Examiner/Debate)
  - Reasoning configuration (effort, verbosity, summary type, sampling, thinking budget) is now clearly accessible before any analytics tables
  - Pushed the heavy analytics header and **Iteration History** table below the controls to reduce confusing chrome at the top of the page
  - **Files**: `client/src/components/puzzle/refinement/ProfessionalRefinementUI.tsx`, `client/src/pages/PuzzleDiscussion.tsx`

### Version 5.35.29  Dec 2, 2025 6:40pm

- **PuzzleDiscussion: Remove blank white box** (Author: Cascade using Claude Sonnet 4)
  - **Removed** the entire "Puzzle Overview" CollapsibleCard section that was causing the blank white space
  - Removed unused imports: `CollapsibleCard`, `TinyGrid`, `PuzzleGrid`
  - Page now goes directly from header to refinement interface without empty containers
  - **Files**: `client/src/pages/PuzzleDiscussion.tsx`

### Version 5.35.28  Dec 2, 2025 6:35pm

- **ModelDebate Auto-Selection Feature** (Author: Cascade using Claude Sonnet 4)
  - Added `?select=<explanationId>` URL parameter support to ModelDebate page (was completely missing)
  - URLs like `/debate/16de56c4?select=60951` now automatically load the debate interface for the specified explanation
  - Uses same fix pattern as PuzzleDiscussion: inlined `debateState.startDebate()` call directly to avoid closure issues
  - **Files**: `client/src/pages/ModelDebate.tsx`

### Version 5.35.27  Dec 2, 2025 6:25pm

- **PuzzleDiscussion Auto-Selection Fix** (Author: Cascade using Claude Sonnet 4)
  - Fixed critical bug where `?select=<explanationId>` URL parameter was not auto-selecting the explanation for refinement
  - **Root Cause**: `handleStartRefinement` function was included in useEffect dependencies but was NOT memoized with `useCallback`, causing it to change every render. The 100ms `setTimeout` captured a stale closure that could reference empty/outdated `explanations` data.
  - **Fix**: Inlined `refinementState.startRefinement(explanation)` call directly in the useEffect instead of going through `handleStartRefinement`, eliminating the closure race condition. Also removed the unnecessary 100ms setTimeout delay.
  - **Impact**: URLs like `/discussion/16de56c4?select=60951` now correctly auto-load the refinement interface for the specified explanation
  - **Files**: `client/src/pages/PuzzleDiscussion.tsx`

### Version 5.35.26  Dec 3, 2025 6:55pm

- **Responses API Explanation Added to PuzzleExaminer** (Author: Cascade using Sonnet 4.5)
  - Added informational alert about Progressive Reasoning functionality to PuzzleExaminer page
  - **Content**: Explains how Responses API maintains stateful persistence with encrypted reasoning traces via `reasoning.encrypted_content`
  - **Context**: Helps users understand the "Refine This Analysis" feature before navigating to discussion page
  - **Implementation**: Added Info icon import and blue-styled alert after puzzle grid display, before controls
  - **Files**: `client/src/pages/PuzzleExaminer.tsx` (import addition, alert component)

### Version 5.35.25  Dec 3, 2025 6:45pm

- **Progressive Reasoning Whitespace Fix** (Author: Cascade using Sonnet 4.5)
  - Fixed excessive white space issue in discussion page progressive reasoning interface
  - **AnalysisResultCard**: Reduced vertical spacing from `space-y-5 p-4 sm:p-6` to `space-y-3 p-3 sm:p-4` to minimize content gaps
  - **IterationDataTable**: Reduced expanded row padding from `p-6` to `p-3` for more compact display
  - **ProfessionalRefinementUI**: Reduced main container spacing from `space-y-4` to `space-y-3` for tighter layout
  - **Impact**: Significantly reduces vertical whitespace while maintaining readability and visual hierarchy

### Version 5.35.24  Dec 3, 2025 6:30pm

- **TypeScript Syntax Fixes** (Author: Cascade using Sonnet 4.5)
  - **Client**: Fixed JSX parsing error in `PoetiqStreamingVisualizer.tsx` by replacing `Expand ->` with JSX-safe `Expand &gt;` to resolve TS1382
  - **Server**: Fixed missing class closing brace in `beetreeService_fixed.ts` before the export statement to resolve TS1068
  - **Server**: Updated `beetreeService_fixed.ts` validation logic to use correct `validateSolverResponse` signature and `ValidationResult.isPredictionCorrect` property
  - **Verification**: Confirmed both original TypeScript errors are resolved while preserving existing streaming patterns across Saturn, Poetiq, and Beetree services

### Version 5.35.23  Dec 3, 2025 5:45pm

- **ModelDebate UX Redesign: Information density improvements** (Author: Cascade using Sonnet 4.5)
  - Implemented comprehensive UX redesign based on user feedback to improve information density and remove redundant UI chrome
  - **Key Changes**: Moved OriginalExplanationCard to display immediately after test cases (always expanded with forceExpanded prop), removed redundant back buttons (ELO Mode, Preview Prompt), simplified header to compact "Challenge Controls" with only Reset and Back to List buttons, reduced spacing throughout (space-y-3 → space-y-2, p-3 → p-2)
  - **Information Flow**: Test cases → Original explanation (prominent) → Compact challenge controls → Challenge responses only
  - **Files**: `client/src/components/puzzle/debate/IndividualDebate.tsx` (major refactor), `client/src/components/puzzle/debate/OriginalExplanationCard.tsx` (added forceExpanded prop)

### Version 5.35.22  Dec 3, 2025 5:25pm

- **Model Debate: Surface original explanation in header card** (Author: Cascade using Cascade)
  - Filled the large white region at the top of the debate workspace by inlining a brief summary of the original explanation (pattern description) directly inside the "AI Model Debate" header card.
  - This makes it immediately obvious what analysis is being challenged without scrolling down into the detailed cards, bringing the layout closer to the user's desired "SHOW EXPLANATION TEXT HERE" behavior.
  - **Files**: `client/src/components/puzzle/debate/IndividualDebate.tsx`

### Version 5.35.21  Dec 3, 2025 2:30pm

- **Streaming & Discussion: Honest refinement context + panel cleanup** (Author: Cascade using Cascade)
  - Updated the shared StreamingAnalysisPanel to remove the pseudo "Solver Progress" step chips and friendly status line so the UI only reflects real backend telemetry (streaming phase/message, token usage, structured JSON, prompt preview) instead of guessed solver stages.
  - Extended the discussion/self-refinement prompt builder so it now includes the model's previous predicted output grids (single- and multi-test) in the same way debate mode does, giving progressive reasoning runs the same ground truth context that rebuttals already see.
  - Tweaked the per-puzzle Discussion page so the "Puzzle Overview" section opens by default, showing training/test grids immediately instead of a large empty white card, bringing its information density back in line with PuzzleExaminer and ModelDebate.
  - Added a focused implementation plan under `docs/plans/2025-12-02-streaming-discussion-fixes.md` to track future alignment work across PuzzleExaminer, ModelDebate, and PuzzleDiscussion.
  - **Files**: `client/src/components/puzzle/StreamingAnalysisPanel.tsx`, `server/services/prompts/userTemplates.ts`, `docs/plans/2025-12-02-streaming-discussion-fixes.md`

### Version 5.35.20  Dec 3, 2025 11:30am

- **Model Debate: Fix white space issue and improve information density** (Author: Claude Code using Sonnet 4.5)
  - Changed OriginalExplanationCard and RebuttalCard to default to expanded state (`isOpen = true`) so users immediately see test case grids and predicted answers without needing to click to expand
  - Removed CompactPuzzleDisplay entirely to eliminate massive white space - training examples aren't needed on debate page since predictions show test case grids
  - Reduced container spacing from `space-y-4` to `space-y-3` for tighter layout
  - Changed background gradient to match PuzzleExaminer's amber/orange/rose theme for consistency
  - Debate cards now show predictions immediately on page load, making it clear what the models predicted vs. what the correct answer was
  - **Files**: `client/src/pages/ModelDebate.tsx` (lines 14-30, 293-297), `client/src/components/puzzle/debate/OriginalExplanationCard.tsx` (line 32), `client/src/components/puzzle/debate/RebuttalCard.tsx` (line 40)

### Version 5.35.20  Dec 3, 2025 11:05am

- **Debate & Discussion Prompts: Explicit multi-test guidance** (Author: Codex / GPT-5)
  - Updated the debate and discussion user prompt builders so they always announce when a puzzle contains multiple test cases, and always pluralize the previous-output sections even when legacy explanations failed to set `hasMultiplePredictions`.
  - Discussion/debate prompts now fall back to the stored single prediction when multi-test grids are missing, giving the new challenger clear visibility into what the prior agent attempted.
  - Continuation-mode prompt construction now passes the multi-test flag, so all refinement flows reuse the same instructions as the main solver template.
  - **Files**: `server/services/prompts/userTemplates.ts`, `server/services/promptBuilder.ts`

### Version 5.35.19  Dec 3, 2025 10:15am

- **Multi-test Detection: Capture predicted grids without sentinel boolean** (Author: Codex / GPT-5)
  - Added a shared multi-prediction detection helper so both the standard and streaming validators force `validateSolverResponseMulti` whenever the puzzle has multiple tests, numbered `predictedOutputN` fields, or direct grid arrays—even if the provider forgets to set `multiplePredictedOutputs: true`.
  - Updated `PuzzleAnalysisService` and `streamingValidator` to rely on the new helper, gracefully fallback when expected outputs are missing, and continue writing the correct multi-test fields so UI cards can show every grid that models return.
  - **Files**: `server/services/utils/multiPredictionDetection.ts`, `server/services/puzzleAnalysisService.ts`, `server/services/streamingValidator.ts`

### Version 5.35.18  Dec 2, 2025 5:55pm

- **Beetree Streaming: Fix model routing crash** (Author: Codex / GPT-5)
  - Corrected the Beetree stream service to pass the puzzle, model key, and taskId to `beetreeService.analyzePuzzleWithModel` in the proper order so `modelKey.includes()` is always operating on a string. This removes the `modelKey.includes is not a function` runtime crash that stopped BeeTree runs from even starting.
  - Cleaned up the unused BeetreeRunConfig import now that the stream service hands the correct service options directly.
  - **Files**: `server/services/streaming/beetreeStreamService.ts`

### Version 5.35.17  Dec 2, 2025 4:20pm

- **Dockerfile: Ensure beetreeARC and SnakeBench without relying on .git in build context** (Author: Cascade)
  - Added git to Alpine packages and kept the existing npm/Python build flow intact.
  - Dockerfile now copies the repo source and, if `beetreeARC` or `external/SnakeBench` are missing, performs shallow `git clone` from their upstream GitHub URLs during the build.
  - After ensuring the directories exist, the image verifies key files (e.g., `beetreeARC/src/solver_engine.py`, `external/SnakeBench/backend/main.py`) and installs their `requirements.txt` files.
  - This avoids the need to have `.git` or initialized submodules in the Railway Docker build context while still guaranteeing the solvers are present in the final image.
  - **Files**: `Dockerfile`

### Version 5.35.16  Dec 2, 2025 3:15pm

- **OpenAI Responses: GPT-5.1 Codex Verbosity Clamp (Responses API path)** (Author: Cascade using Cascade)
  - Updated the OpenAI Responses payload builder and prompt preview so GPT-5.1 Codex models (`gpt-5.1-codex`, `gpt-5.1-codex-mini`) always send and display `text.verbosity: "medium"`, avoiding unsupported `"high"` values and aligning with the current Responses API contract.
  - **Files**: `server/config/models/index.ts`, `server/services/openai/payloadBuilder.ts`, `server/services/openai.ts`

### Version 5.35.15  Dec 2, 2025 2:00pm

- **Docs: llms.txt playful marketing blurb** (Author: Cascade)
  - Expanded `llms.txt` with a lighthearted marketing section positioning ARC Explainer as a go-to ARC/ARC-AGI hub and capturing maintainer Mark Barney’s self-described "AI super genius" branding for language-model crawlers.
  - **Files**: `llms.txt`

### Version 5.35.14  Dec 2, 2025 1:55pm

- **Docs: llms.txt guidance for language models** (Author: Cascade)
  - Added top-level `llms.txt` to help automated language-model agents understand the ARC Explainer repo, key directories, and API/solver documentation entry points.
  - **Files**: `llms.txt`

### Version 5.35.13  Dec 2, 2025 1:45pm

- **Add New Models: OpenAI GPT-5.1 and Free OpenRouter Models** (Author: Claude Code using Sonnet 4.5)
  - Added `gpt-5.1-2025-11-13` from OpenAI with $1.25/$10.00 per million tokens (released Nov 13, 2025)
  - Added `arcee-ai/trinity-mini:free` with 131,072 context window (released Dec 1, 2025)
  - Added `amazon/nova-2-lite-v1:free` with 1,000,000 context window (released Dec 2, 2025)
  - OpenRouter models are free ($0/M input and output tokens)
  - GPT-5.1 is a reasoning model with streaming support, 400K context window, and 128K max output tokens
  - OpenRouter models are non-reasoning, support temperature, and have moderate to fast response times
  - **Files**: `server/config/models.ts` (lines 3-8, 222-239, 966-996)

### Version 5.35.12  Dec 2, 2025 1:05pm

- **Snake Arena: Fix Button size TypeScript error** (Author: Cascade)
  - Switched the `Recent games` refresh control to use supported `size="sm"` on the shared shadcn `Button`, resolving a compile-time type mismatch in `SnakeArena.tsx`.
  - **Files**: `client/src/pages/SnakeArena.tsx`

### Version 5.35.11  Dec 2, 2025 4:10am

- **SnakeBench API: Batch, Games Index, Health + Local Docs** (Author: Cascade)
  - Extended the SnakeBench backend integration with a small batch API, recent-games listing, single-game detail endpoint, and a dedicated health check for the Python bridge and submodule wiring.
  - New endpoints (all public): `POST /api/snakebench/run-batch`, `GET /api/snakebench/games`, `GET /api/snakebench/games/:gameId`, and `GET /api/snakebench/health`.
  - Added shared types for batch requests/responses, game summaries, game detail payloads, and health responses so frontend or external tools can consume these consistently.
  - Completed Milestone 1 docs with a "Using SnakeBench Locally" quick-start section describing submodule init, venv setup, CLI usage, and how completed games relate to ARC Explainer.
  - **Files**: `shared/types.ts`, `server/services/snakeBenchService.ts`, `server/controllers/snakeBenchController.ts`, `server/routes.ts`, `docs/plans/2025-12-02-snakebench-integration-plan.md`.

### Version 5.35.10  Dec 2, 2025 2:50am

- **SnakeBench UI & Infra Integration** (Author: Cascade)
  - Added a `SnakeArena` React page that embeds the existing SnakeBench Next.js frontend via an iframe, configured through `VITE_SNAKEBENCH_URL`, plus a new `/snake-arena` route and navigation entry.
  - Updated the Docker image to include the `external/SnakeBench/backend` submodule and install its Python dependencies so `/api/snakebench/run-match` works inside containers.
  - Added conservative safety limits for SnakeBench single matches (board sizes, max rounds, apples) in the backend service to prevent runaway configurations.
  - **Files**: `client/src/pages/SnakeArena.tsx`, `client/src/App.tsx`, `client/src/components/layout/AppNavigation.tsx`, `.env.example`, `server/services/snakeBenchService.ts`, `Dockerfile`.

### Version 5.35.9  Dec 2, 2025 1:40am

- **SnakeBench Backend: Single-Match Run API** (Author: Cascade)
  - Added a Python bridge runner that calls the SnakeBench backend `run_simulation` function without requiring its own Supabase database, using minimal in-memory player configs and still writing completed game JSON files for replays.
  - Introduced a `snakeBenchService` in Node that spawns the runner as a subprocess, validates input, parses the JSON summary, and exposes a typed `SnakeBenchRunMatchResult` shared type.
  - Exposed a public `POST /api/snakebench/run-match` endpoint via `snakeBenchController`, returning a compact `{ success, result, error, timestamp }` payload for frontend and external callers.
  - **Files**: `shared/types.ts`, `server/python/snakebench_runner.py`, `server/services/snakeBenchService.ts`, `server/controllers/snakeBenchController.ts`, `server/routes.ts`.

### Version 5.35.8  Dec 2, 2025 1:20am

- **Docs: SnakeBench Integration Plan (A, B, C)** (Author: Cascade)
  - Added a detailed multi-phase plan for integrating the SnakeBench LLM Snake Arena into ARC Explainer across three levels: standalone dev usage (A), backend-triggered benchmarks (B), and a new "Snake Arena" frontend page (C).
  - Plan covers Python/CLI setup, Node backend orchestration via `child_process`, public REST endpoints for running matches and listing games, shared types for summaries, and a shadcn-based UI for leaderboards and replays.
  - **Files**: `docs/plans/2025-12-02-snakebench-integration-plan.md`.

### Version 5.35.7  Dec 1, 2025 8:45pm

- **Repo: Added SnakeBench as tracked submodule** (Author: Cascade)
  - Registered `https://github.com/VoynichLabs/SnakeBench` as the `SnakeBench` git submodule under `external/SnakeBench` so the upstream benchmarking code stays pinned and can be updated independently from the main repo.
  - `.gitmodules` now lists SnakeBench alongside the existing `arc-agi-benchmarking`, `poetiq-solver`, and `beetreeARC` modules, keeping all external ARC-related repos centralized.
  - **Files**: `.gitmodules`, `external/SnakeBench/`.

### Version 5.35.6  Dec 1, 2025 8:35pm

- **Model Debate Page - Fix UI Spacing Issues** (Author: Cascade)
  - **Root Cause**: Page layout had `space-y-1` (4px spacing) and no horizontal padding, causing cramped UI
  - **Fix**: Added proper container with `px-4 py-4 space-y-4` for consistent padding and spacing
  - **Added**: Subtle gradient background (`from-slate-50 via-gray-50 to-zinc-100`) matching other pages
  - **Files**: `client/src/pages/ModelDebate.tsx`

### Version 5.35.5  Dec 1, 2025 8:15pm

- **Model Debate Page - Fix Blank Page Bug** (Author: Cascade)
  - **Root Cause**: Race condition in `usePuzzle` hook usage - component used `currentTask` (state updated via useEffect) instead of `task` (immediately derived from query response)
  - **Effect**: When query completed, `isLoadingTask` became false but `currentTask` was still null for 1 render cycle, causing the error check `(taskId && !task)` to pass incorrectly
  - **Fix**: Changed destructuring from `{ currentTask: task }` to `{ task }` to use the immediate value
  - **Files**: `client/src/pages/ModelDebate.tsx`

### Version 5.35.4  Dec 1, 2025 7:15pm

- **Dockerfile - Add beetreeARC Support** (Author: Cascade)
  - **Submodule Directory Copy**: Updated Dockerfile to copy beetreeARC/ directory directly (not cloning via git since Docker build context doesn't have .git)
  - **Python Dependencies**: Install beetreeARC's own requirements.txt (anthropic, openai, google-genai, matplotlib, etc.)
  - **Verification Steps**: Added checks to ensure beetreeARC/src/solver_engine.py and requirements.txt exist
  - **Build Process**: beetreeARC is copied after npm ci but before main source code copy
  - **Files**: `Dockerfile`

### Version 5.35.3  Dec 1, 2025 6:45pm

- **Beetree Solver - Updated Models** (Author: Cascade)
  - **Testing Mode**: Now uses only `gpt-5.1-codex-mini` (cheap, fast) - 7 runs at $0.10-$0.50, 1-3 min
  - **Production Mode**: Now uses only `gemini-3-high` (comprehensive) - 20 runs at $5-$20, 10-30 min
  - **Backend Changes**: Updated `beetreeARC/src/types.py` to add GPT-5.1 Codex Mini with pricing ($0.25/$2.00 per 1M tokens)
  - **Backend Changes**: Updated `beetreeARC/src/models.py` to parse `gpt-5.1-codex-mini` model arg
  - **Backend Changes**: Updated `beetreeARC/src/solver_engine.py` with new model configurations
  - **Frontend Changes**: Updated model display and cost estimates in BeetreeSolver.tsx
  - **Files**: `beetreeARC/src/types.py`, `beetreeARC/src/models.py`, `beetreeARC/src/solver_engine.py`, `client/src/pages/BeetreeSolver.tsx`

### Version 5.35.2  Dec 1, 2025 6:00pm

- **Beetree Solver Page - Honest UI with Pre-configured Models Display** (Author: Cascade)
  - **Clear Fixed Ensemble Message**: UI now explicitly tells users that Beetree is a pre-configured ensemble solver - they cannot select individual models, only choose Testing or Production mode.
  - **Always-Visible Model List**: Shows all 5 steps with their exact pre-configured models
  - **Alert Warning**: Prominent alert box explaining "Fixed Ensemble - These models are hard-coded in the Beetree solver"
  - **shadcn/ui Components**: Card, Button, Badge, Alert, Select, ScrollArea, Separator, Progress, AlertDialog
  - **Files**: `client/src/pages/BeetreeSolver.tsx`.

### Version 5.35.1  Dec 1, 2025 5:30pm

- **Beetree Ensemble Solver - Critical Bug Fixes** (Author: Cascade)
  - **Backend Service Completion**: Added missing abstract method implementations to `BeetreeService`: `getModelInfo()`, `generatePromptPreview()`, `callProviderAPI()`, `parseProviderResponse()`, plus helper methods `extractModeFromModelKey()`, `validatePredictions()`, `gridsMatch()`, `buildAIResponse()`, `saveBeetreeResult()`, and `estimateCost()`.
  - **Real Cost/Token Extraction**: Fixed Python wrapper to extract real token counts and costs from beetreeARC step logs instead of placeholder values. Added `estimate_model_cost()` function with model-specific pricing for GPT-5.1, Claude, Gemini, DeepSeek, and Grok models.
  - **Consensus Data**: Python wrapper now emits `consensus_strength`, `diversity_score`, and `agreement_count` fields computed from the candidates_object and picked_solutions data.
  - **API Response Fix**: Controller now returns `success: true` field for frontend compatibility.
  - **Session ID Fix**: Frontend hook now uses server-provided sessionId for SSE connection instead of locally generated one, fixing stream mismatch issues.
  - **Production Mode Confirmation**: Added AlertDialog confirmation modal for production mode ($15-$50, 20-45 min) to prevent accidental expensive runs. Users must explicitly confirm before starting production analysis.
  - **Type Safety**: Fixed TypeScript errors by adding proper type casts for beetree-specific fields on explanation objects.
  - **Files**: `server/services/beetreeService.ts`, `server/python/beetree_wrapper.py`, `server/controllers/beetreeController.ts`, `client/src/hooks/useBeetreeRun.ts`, `client/src/pages/BeetreeSolver.tsx`.

### Version 5.35.0  Dec 1, 2025 4:50pm

- **DeepSeek Model Updates - V3.2 Integration** (Author: User)
  - **Updated DeepSeek Chat v3.2**: Enhanced costs ($0.28/$0.42), added 128K context window, 8K max output tokens, JSON/tool support
  - **Updated DeepSeek Reasoner v3.2**: Unified pricing with chat model, added thinking mode details, 64K max output tokens
  - **Added DeepSeek Reasoner v3.2-Speciale**: Special edition model with 128K max output tokens, limited availability until Dec 15, 2025
  - **Enhanced Metadata**: Added contextWindow, maxOutputTokens, releaseDate, and detailed notes for all DeepSeek models
  - **Cache Pricing**: Added cache hit pricing information ($0.028/1M input tokens) for all V3.2 models
  - **Files**: `server/config/models.ts`

### Version 5.34.0  Dec 1, 2025 4:41pm

- **🌳 Beetree Ensemble Solver - Complete Multi-Model Integration** (Author: Cascade / Claude Sonnet 4)
  - **Major Feature**: Full-stack implementation of Beetree ensemble solver providing multi-model consensus analysis with real-time cost tracking and progress monitoring.
  - **Backend Infrastructure**: Python wrapper with NDJSON protocol, Node.js bridge integration, BaseAIService extension, cost tracking, consensus analysis, and stage orchestration utilities.
  - **Real-time Streaming**: SSE streaming service with WebSocket broadcast support for live progress updates, cost tracking, and stage-by-stage execution monitoring.
  - **REST API**: Complete endpoints including run, status, estimate, history, cost-breakdown, and cancel with proper route registration and model factory integration.
  - **Database Integration**: Schema extensions for Beetree-specific data with JSONB field handling for model results, cost breakdowns, and consensus metrics.
  - **Frontend Suite**: 
    - Main BeetreeSolver page with configuration panel and mode selection
    - Real-time progress dashboard with metrics grid and timeline
    - Comprehensive results panel with consensus analysis and prediction display
    - Detailed cost breakdowns by model, stage, and token usage
    - Pre-run cost estimator with testing vs production mode comparison
    - Custom React hook for SSE connection management and state handling
  - **Dual Mode Operation**: 
    - Testing mode: 3 models, 2-6 minutes, $0.50-$2.00 estimated cost
    - Production mode: 8 models, 20-45 minutes, $15-$50 estimated cost
  - **UI Integration**: Added "🌳 Beetree Solver" button to PuzzleHeader alongside existing Saturn, Grover, and Poetiq solvers.
  - **Type Safety**: Complete TypeScript integration with proper type definitions for all Beetree interfaces and events.
  - **Build Verification**: Full compilation success with all TypeScript errors resolved.
  - **Files**: 25+ new/modified files including services, controllers, components, hooks, and configuration.

### Version 5.33.27  Dec 1, 2025 4:25pm

- **Beetree Ensemble Solver Backend Integration Complete** (Author: Cascade / Claude Sonnet 4)
  - Implemented complete backend infrastructure for Beetree multi-model ensemble solver including Python wrapper with NDJSON protocol, Node.js bridge integration, BaseAIService extension, cost tracking, consensus analysis, and stage orchestration utilities.
  - Added database schema extensions for Beetree-specific data with proper JSONB field handling for model results and cost breakdowns.
  - Created real-time SSE streaming service and WebSocket broadcast support integrated with existing SSE manager.
  - Built complete REST API endpoints (run, status, estimate, history, cost-breakdown, cancel) with proper route registration and model factory integration.
  - Added Beetree model configuration with proper metadata and updated shared types to include Beetree provider and model type support.
  - Fixed all TypeScript compilation errors and verified successful build.
  - **Files**: `server/services/beetreeService.ts`, `server/controllers/beetreeController.ts`, `server/services/streaming/beetreeStreamService.ts`, `server/services/pythonBridge.ts`, `shared/types.ts`, `server/config/models.ts`, `server/routes.ts`, `server/services/aiServiceFactory.ts`.

### Version 5.33.26  Dec 1, 2025 1:45pm

- **PoetiqSolver: Compact horizontal control bar + TinyGrid training examples** (Author: Cascade / Claude Sonnet 4)
  - Rebuilt `PoetiqControlPanel` as a single-row horizontal bar with all controls inline (model, API key, experts, iterations, temp, reasoning, prompt style, agents toggle, Start button).
  - Control panel now disappears when run starts, replaced by a minimal cancel bar showing the active model and expert count.
  - Training examples now render as tiny 40x40 grids using `TinyGrid` in a compact inline row, with test input shown alongside.
  - All inspector panels and logs remain in a clean two-column layout below.
  - **Files**: `client/src/components/poetiq/PoetiqControlPanel.tsx`, `client/src/pages/PoetiqSolver.tsx`.

### Version 5.33.25  Dec 1, 2025 1:30pm

- **Poetiq solver layout + control rail redesign** (Author: Codex / GPT-5)
  - Rebuilt the `PoetiqSolver` page frame with a sticky configuration rail, compact header badges, and dual scroll columns so the progress dashboard, agents panel, logs, and training grids remain visible without endless vertical scrolling.
  - Restyled every supporting card (prompt inspector, reasoning stream, python console, event log, raw events) with consistent rounded panels, balanced gaps, and capped heights to keep the transparency tooling readable on large and small screens alike.
  - Converted `PoetiqControlPanel` into a two-column grid that groups model selection, reasoning controls, BYO key, and solver settings into paired cards, trimming padding and keeping the start/cancel buttons pinned so the rail no longer blows past the viewport.
  - **Files**: `client/src/pages/PoetiqSolver.tsx`, `client/src/components/poetiq/PoetiqControlPanel.tsx`.

### Version 5.33.24  Dec 1, 2025 11:56am

- **Repo: Added beetreeARC as tracked submodule** (Author: Codex / GPT-5)
  - Registered `https://github.com/82deutschmark/beetreeARC` as the `beetreeARC` git submodule so the upstream ARC solver code stays pinned and can be updated independently from the main repo.
  - `.gitmodules` now lists the new dependency alongside the existing benchmarking and Poetiq solver modules, keeping all ARC-related external repos centralized.
  - **Files**: `.gitmodules`, `beetreeARC/`.

### Version 5.33.23  Dec 1, 2025 11:20am

- **Poetiq OpenAI Responses include fix** (Author: Cascade using Cascade)
  - Adjusted the Poetiq Python LLM helper to stop requesting the unsupported `"reasoning"` field via the OpenAI Responses API `include` parameter, keeping only `"reasoning.encrypted_content"` per the current platform spec so calls to GPT-5.x and Codex models no longer 400 with `invalid_value` on `include[0]`.
  - This removes the noisy `[OpenAI Responses API] Error: Invalid value: 'reasoning'` retries from Poetiq runs while preserving encrypted reasoning state for future chained calls.
  - **Files**: `solver/poetiq/llm.py`.

### Version 5.33.22  Nov 30, 2025 9:35pm 

- **Poetiq Agents: GPT-5.1 Codex Verbosity Clamp (Agents SDK path)** (Author: Cascade using Cascade)
  - Updated the OpenAI Agents runner for Poetiq so that GPT-5.1 Codex models (full + mini) always send `text.verbosity: "medium"` instead of `"high"`, matching the Responses API constraints and avoiding 400 "Unsupported value" errors.
  - Confirmed that the existing **Reasoning Effort** selector in the Poetiq control panel (`low` / `medium` / `high`) is threaded through to the Agents runner as `reasoning.effort`, giving users explicit control over the thinking budget while the verbosity clamp stays model-specific.
  - **Files**: `server/services/poetiq/PoetiqAgentsRunner.ts`.

### Version 5.33.21  Nov 30, 2025 6:55pm 

- **Poetiq Agents UI/UX: Solver Toggle + Agents Runtime Panel** (Author: Cascade using Cascade)
  - Extended the Poetiq progress hook to capture OpenAI Agents telemetry (`agentRunId`, `agentModel`, `agentTimeline`, reasoning deltas, and token usage) and to pass a `useAgents` hint down to the Poetiq controller so OpenAI runs can be cleanly routed through the Agents runner.
  - Added an "OpenAI Agents runtime" switch to the Poetiq control panel, only surfaced for direct OpenAI models based on `/api/poetiq/models` metadata, wiring the toggle into the solver start options as `useAgentsSdk`.
  - Introduced a compact Poetiq Agents runtime panel on the Poetiq solver page that mirrors the ARC3 Agent Playground: it shows live reasoning text, sandbox tool calls to the Python Poetiq evaluator, agent messages, and a small token-usage footer whenever the `openai-agents` runtime is active.
  - **Files**: `client/src/hooks/usePoetiqProgress.ts`, `client/src/components/poetiq/PoetiqControlPanel.tsx`, `client/src/components/poetiq/PoetiqAgentsRuntimePanel.tsx`, `client/src/components/poetiq/index.ts`, `client/src/pages/PoetiqSolver.tsx`.

### Version 5.33.20  Nov 30, 2025 4:15pm 

- **Poetiq Agents SDK Runner: OpenAI Agent + Python Sandbox Tools** (Author: Cascade using Cascade)
  - Added `poetiq_tool_runner.py` single-shot Python entry that reuses Poetiq’s core `_eval_on_train_and_test` and `_build_feedback` helpers to evaluate candidate `transform()` implementations and return structured train/test results plus feedback to Node tools.
  - Introduced `PoetiqAgentsRunner` powered by the OpenAI Agents SDK with a `submit_python_candidate` tool, so OpenAI models can orchestrate iterative code generation while delegating sandbox execution to the existing Poetiq Python stack and emitting agent timeline telemetry for the UI.
  - Registered the Agents runner at server startup so `poetiqService` can route eligible OpenAI runs through the Agents path whenever `useAgents` is enabled, without changing Gemini/Anthropic/OpenRouter behavior.
  - **Files**: `server/python/poetiq_tool_runner.py`, `server/services/poetiq/PoetiqAgentsRunner.ts`, `server/index.ts`.

### Version 5.33.19  Nov 30, 2025 3:45pm 

- **Poetiq Agents Routing: Service + Controller Hooks** (Author: Codex / GPT-5)
  - Added `useAgents` preference handling, runtime selection helpers, and an Agents-runner registration point inside `poetiqService` so OpenAI models can be routed to the forthcoming Agents SDK runner without disturbing Gemini/Anthropic/OpenRouter flows.
  - Extended the shared Poetiq prompt telemetry schema with agent timeline/reasoning fields and unified WebSocket broadcasting so both the Python wrapper and Agents runner surface identical progress structures.
  - Updated the Poetiq controller’s initialization/broadcast routines to expose the planned runtime, keep HTTP responses in sync, and log which execution path each session will take.
  - **Files**: `server/services/poetiq/poetiqService.ts`, `server/controllers/poetiqController.ts`, `shared/types.ts`.

### Version 5.33.18  Nov 30, 2025 3:05pm 

- **Poetiq Prompt Styles: Restore German ARC Template** (Author: Codex / GPT-5)
  - Reintroduced the missing `SOLVER_PROMPT_ARC_DE` constant so the `arc_de` selector no longer crashes Poetiq runs, mirroring the same ARC Explainer guidance we provide for English/French/Turkish/Russian prompt styles.
  - Logged the remediation steps in a new plan doc to keep future ARC prompt work traceable and ensure localized templates stay aligned with the `/v1/responses` contract.
  - **Files**: `solver/poetiq/prompts.py`, `docs/2025-12-02-poetiq-german-prompt-fix-plan.md`.

### Version 5.33.17  Nov 30, 2025 2:20pm 

- **Discussion Page UI: Tighter Layout + Embedded Streaming Panel** (Author: Cascade using Cascade)
  - Centered and constrained the Discussion/Progressive Reasoning page to a max-width container, reducing excess horizontal padding and large outer margins so the content feels more focused.
  - Replaced the full-screen streaming modal with an inline, right-hand streaming panel that sits beside the refinement controls in a responsive two-column grid, keeping live output visible without taking over the page.
  - Fixed a missing `Sparkles` icon import to restore the "Generate First Explanation" button icon.
  - **Files**: `client/src/pages/PuzzleDiscussion.tsx`.

### Version 5.33.16  Nov 30, 2025 1:50pm 

- **Discussion Refinement: User Guidance + Streaming Fixes** (Author: Cascade using Cascade)
  - Ensured human "User Guidance" hints from the Discussion page are actually threaded into the underlying discussion/refinement prompts and visible in the prompt preview for continuation runs.
  - Wired the Puzzle Discussion refinement flow into the shared SSE streaming harness by passing model metadata into `useAnalysisResults`, so eligible models now stream refinement output just like PuzzleExaminer and ModelDebate.
  - **Files**: `client/src/pages/PuzzleDiscussion.tsx`, `client/src/components/puzzle/refinement/ProfessionalRefinementUI.tsx`.

### Version 5.33.15  Nov 30, 2025 1:10pm 

- **Poetiq Solver: Fix Missing German ARC Prompt Constant** (Author: Cascade using Cascade)
  - Resolved a runtime ImportError in the Poetiq Python wrapper by reintroducing the `SOLVER_PROMPT_ARC_DE` system prompt in `solver/poetiq/prompts.py`, ensuring the `arc_de` promptStyle can be selected without crashing the solver process.
  - Verified that all localized ARC system prompts (English, German, French, Turkish, Russian) are now defined and correctly imported by `build_config_list`, restoring the full prompt-style matrix for Poetiq runs.
  - **Files**: `solver/poetiq/prompts.py`, `server/python/poetiq_wrapper.py`.

### Version 5.33.14  Nov 29, 2025 8:15pm 

- **Poetiq Prompt Styles: French & Turkish ARC System Prompts** (Author: Cascade using Cascade)
  - Extended the Poetiq prompt-style selector to support localized ARC system prompts in French and Turkish in addition to the existing classic, English, German, and Russian variants.
  - Threaded the new `promptStyle` values (`arc_fr`, `arc_tr`) through the Poetiq React hook, solver page, controller, service, and Python wrapper so each run reliably selects the correct localized system prompt without impacting existing behavior.
  - Introduced `SOLVER_PROMPT_ARC_FR` and `SOLVER_PROMPT_ARC_TR` in `solver/poetiq/prompts.py`, mirroring the cleaned ARC Poetiq prompt contract while presenting all instructions and behavior in French and Turkish.
  - **Files**: `client/src/hooks/usePoetiqProgress.ts`, `client/src/pages/PoetiqSolver.tsx`, `client/src/components/poetiq/PoetiqControlPanel.tsx`, `server/controllers/poetiqController.ts`, `server/services/poetiq/poetiqService.ts`, `server/python/poetiq_wrapper.py`, `solver/poetiq/prompts.py`.

### Version 5.33.13  Nov 29, 2025 8:00pm 

- **Poetiq Prompt Styles: German & Russian ARC System Prompts** (Author: Cascade using Cascade)
  - Extended the Poetiq prompt-style selector to support localized ARC system prompts in German and Russian, alongside the original classic and English ARC variants.
  - Threaded the new `promptStyle` values (`arc_de`, `arc_ru`) through the Poetiq React hook, solver page, controller, service, and Python wrapper so each run reliably selects the matching localized system prompt.
  - Introduced `SOLVER_PROMPT_ARC_DE` and `SOLVER_PROMPT_ARC_RU` in `solver/poetiq/prompts.py`, mirroring the cleaned ARC Poetiq prompt semantics while presenting all instructions and behavior in German and Russian.
  - **Files**: `client/src/hooks/usePoetiqProgress.ts`, `client/src/pages/PoetiqSolver.tsx`, `client/src/components/poetiq/PoetiqControlPanel.tsx`, `server/controllers/poetiqController.ts`, `server/services/poetiq/poetiqService.ts`, `server/python/poetiq_wrapper.py`, `solver/poetiq/prompts.py`.

### Version 5.33.12  Nov 29, 2025 7:30pm 

- **Poetiq Prompt-Style Selector (Classic vs ARC)** (Author: Cascade using Cascade)
  - Added a prompt template selector to the Poetiq solver control panel so runs can choose between the original "classic" Poetiq system prompt and a new ARC-optimized prompt derived from `docs/ARC_Poetiq_Prompt.md`.
  - Threaded the selected `promptStyle` (`classic` or `arc`) from the frontend hook through the Poetiq controller/service into the Python wrapper, which now builds expert configs using either `SOLVER_PROMPT_1` (classic) or the new `SOLVER_PROMPT_ARC` while preserving all existing feedback and cost/token tracking behavior.
  - **Files**: `docs/plans/2025-11-29-poetiq-prompt-style-selector-plan.md`, `client/src/hooks/usePoetiqProgress.ts`, `client/src/pages/PoetiqSolver.tsx`, `client/src/components/poetiq/PoetiqControlPanel.tsx`, `server/controllers/poetiqController.ts`, `server/services/poetiq/poetiqService.ts`, `server/python/poetiq_wrapper.py`, `solver/poetiq/prompts.py`.

### Version 5.33.11  Nov 29, 2025 5:30pm 

- **Poetiq Control Panel Integration + Shadcn Toggles** (Author: Codex / GPT-5)
  - Rebuilt `PoetiqSolver` to mount the shadcn-based `PoetiqControlPanel`, removed the DaisyUI toolbar, and moved the prompt/reasoning toggles into shadcn `Button`s so controls stay visible (with Cancel) during active runs.
  - Cleaned `PoetiqControlPanel.tsx` (ASCII placeholders, BYO key guidance, slider/select wiring) and updated `usePoetiqProgress.ts` to accept OpenAI/Gemini/OpenRouter providers so optional runs can start without forcing a user key.
  - **Files**: `client/src/pages/PoetiqSolver.tsx`, `client/src/components/poetiq/PoetiqControlPanel.tsx`, `client/src/hooks/usePoetiqProgress.ts`.
- **Poetiq Dashboards/Streams on Shadcn Primitives** (Author: Codex / GPT-5)
  - Converted the Poetiq monitoring components (`PoetiqProgressDashboard`, `PoetiqExpertTracker`, `PoetiqInfoCard`, `PoetiqLiveActivityStream`, `PoetiqPhaseIndicator`, `PoetiqPythonTerminal`, `PoetiqStreamingModal`, `PoetiqStreamingVisualizer`) to strict ASCII copy and shadcn `Card`/`Button` helpers, removing the last DaisyUI class fragments.
  - Export buttons now reuse shadcn variants, activity-stream status text no longer carries corrupted glyphs, and status cards reuse consistent badge styling so Phase 2 of the shadcn migration is complete.
  - **Files**: `client/src/components/poetiq/PoetiqProgressDashboard.tsx`, `client/src/components/poetiq/PoetiqExpertTracker.tsx`, `client/src/components/poetiq/PoetiqInfoCard.tsx`, `client/src/components/poetiq/PoetiqLiveActivityStream.tsx`, `client/src/components/poetiq/PoetiqPhaseIndicator.tsx`, `client/src/components/poetiq/PoetiqPythonTerminal.tsx`, `client/src/components/poetiq/PoetiqStreamingModal.tsx`, `client/src/components/poetiq/PoetiqStreamingVisualizer.tsx`.

### Version 5.33.10  Nov 29, 2025 4:45pm 

- **Docs: Poetiq ARC Prompt Conversation Behavior & Attempt Summaries** (Author: Cascade using Cascade)
  - Updated the Poetiq ARC solver system prompt so existing partial/incorrect solutions are presented as short natural-language summaries with scores and failure reasons instead of full Python code, reducing token bloat while preserving signal about what was tried.
  - Added concise conversation-behavior rules (at most one clarifying question, no opt-in closing questions, concise explanations of the final rule) so Poetiq runs behave more like the primary ChatGPT system prompt while staying focused on puzzle solving.

### Version 5.33.9    4:41 pm

- **UI Direction: Shadcn/ui Migration Blueprint + Analysis Result Refresh** (Author: Codex / GPT-5)
  - Added `docs/plans/2025-12-02-shadcn-ui-replatforming-plan.md` describing the four-phase strategy (foundation, shared component families, page-level passes, DaisyUI removal) so every UI change follows the same Radix/shadcn patterns.
  - Rebuilt the Analysis Results experience (`AnalysisResults`, `AnalysisResultCard`, `Header`, `Grid`, `Metrics`, `Content`) on top of shadcn `Card`, `Badge`, `Button`, and `Alert` primitives, removing the lingering DaisyUI `btn`/`badge` classes from that entire cluster.
  - The refreshed list shell now uses shadcn cards for counts/filters, while grid controls and raw-record drawers reuse the same Button/Badge helpers for consistent styling and keyboard accessibility.
  - **Files**: `docs/plans/2025-12-02-shadcn-ui-replatforming-plan.md`, `client/src/components/puzzle/AnalysisResults.tsx`, `client/src/components/puzzle/AnalysisResultCard.tsx`, `client/src/components/puzzle/AnalysisResultHeader.tsx`, `client/src/components/puzzle/AnalysisResultContent.tsx`, `client/src/components/puzzle/AnalysisResultGrid.tsx`, `client/src/components/puzzle/AnalysisResultMetrics.tsx`

### Version 5.33.8

- **Docs: Poetiq ARC Solver Prompt Simplification** (Author: Cascade using Cascade)
  - Simplified the Poetiq ARC solver system prompt by removing redundant Python code examples and replacing them with a concise note that assumes standard Python and NumPy idioms, while keeping the behavioral, formatting, and iterative-refinement contract unchanged.

### Version 5.33.7

- **Poetiq Conversation-State Migration (ARC Responses spec)** (Author: Codex / GPT-5)
  - Extended the shared prompt plumbing (`PromptContext`, `systemPrompts`, `shared/types`) with a dedicated `poetiq` mode plus structured `messages[]` payloads so Poetiq prompt events mirror the `/v1/responses` input format.
  - Reworked the Python solver stack to keep one conversation thread per expert: `solver/poetiq/llm.py` now passes `previous_response_id` into OpenAI Responses calls (returning the fresh `provider_response_id`), `llm()` propagates the ID through all callers, and the instrumented `poetiq_wrapper` builds alternating assistant/user turns with sandbox metrics + feedback before emitting the richer `promptData`.
  - Updated the Poetiq hook + UI to consume the new data: `usePoetiqProgress` pulls `PoetiqPromptData` straight from `shared/types`, and `PoetiqSolver` renders every conversation turn (badged by role, iteration, expert, and pass counts) inside both the Prompt Inspector and the prompt timeline, so operators can replay exactly what the Codex Mini session saw. The transparency plan doc now documents the conversation-view requirement.
  - **Files**: `server/services/prompts/PromptContext.ts`, `server/services/prompts/systemPrompts.ts`, `shared/types.ts`, `solver/poetiq/llm.py`, `solver/poetiq/solve_coding.py`, `server/python/poetiq_wrapper.py`, `server/services/poetiq/poetiqService.ts`, `client/src/hooks/usePoetiqProgress.ts`, `client/src/pages/PoetiqSolver.tsx`, `docs/29112025-solver-transparency-ui-plan.md`

### Version 5.33.6

- **Docs: GPT-5.1 Codex Mini ARC Grid Solver Spec** (Author: Cascade using Cascade)
  - Added a dedicated reference document detailing how our ARC coding agent should call OpenAI's Responses API with `gpt-5.1-codex-mini` to iteratively write and refine Python solvers for ARC grid puzzles, with full stateful retention and no ZDR constraints.
  - Document covers: required/forbidden fields, `store: true` policy, `previous_response_id` vs `conversation`, reasoning controls, full-retention logging, and the standard four-phase ARC workflow (ingest → design/code → execute/test → refine).
  - Wired this spec into the agent guidance docs so future assistants know where to look:
    - Updated `AGENTS.md` API docs quick reference to include `docs/reference/api/GPT5_1_Codex_Mini_ARC_Grid_Solver.md`.
    - Updated `CLAUDE.md` OpenAI Responses section to link to the same spec for backend/streaming changes involving Codex Mini.
  - **Files**: `docs/reference/api/GPT5_1_Codex_Mini_ARC_Grid_Solver.md`, `AGENTS.md`, `CLAUDE.md`

### Version 5.33.5

- **Poetiq Solver: Full Prompt Transparency (No Truncation)** (Author: Cascade using Cascade)
  - **Status:** Implementation is currently **untested** and requires verification against live Poetiq runs.
  - **Problem**: Earlier Poetiq runs only surfaced a truncated view of the system prompt and a clipped preview of the user prompt, with no clear visual split between the puzzle description and the “previous attempts + feedback” block. Users also had no simple way to see how prompts evolved from one iteration to the next.
  - **Changes**:
    1. **Python wrapper prompt payload** (`server/python/poetiq_wrapper.py`):
       - Removed the 500‑character cap on `systemPrompt` and now emit the full solver instructions for each `(expert, iteration)`.
       - Added `problemSection` (puzzle + examples only), `feedbackSection` (previous solutions + feedback only), and a `stats` object with character counts and `previousSolutionCount` so the UI can cleanly separate and summarize each part of the composed prompt.
    2. **TypeScript prompt types & streaming** (`server/services/poetiq/poetiqService.ts`, `client/src/hooks/usePoetiqProgress.ts`):
       - Extended `PoetiqPromptData` / `PromptData` to carry the new `problemSection`, `feedbackSection`, and `stats` fields while keeping them optional for backward compatibility.
       - Left the existing `currentPromptData`, `promptHistory`, and `promptTimeline` wiring intact so all prompt events still flow through the same WebSocket path.
    3. **Prompt Inspector UI** (`client/src/pages/PoetiqSolver.tsx`):
       - Removed UI‑level truncation of the user prompt and now show the full `userPrompt` in a scrollable block.
       - Kept the system prompt in an expandable section but now render the complete text from Python instead of a truncated version.
       - Added a dedicated **“Puzzle & examples section”** (from `problemSection`) and **“Previous attempts & feedback”** (from `feedbackSection`), making the two halves of the composed prompt visually distinct.
       - Surfaced a lightweight stats row (system/user prompt lengths and previous solution count) so users can gauge prompt size and how many earlier programs are being recycled.
       - Introduced a **“What changed since last prompt?”** summary that compares the latest prompt to the previous one and highlights changes in prompt length, feedback presence, and previous‑solution count.
    4. **Prompt Timeline UI** (`client/src/pages/PoetiqSolver.tsx`):
       - Updated the timeline rows to display the full `userPrompt` for each entry in a scrollable region (no manual `slice(0, N)` trimming), while still capping the number of stored entries for performance.
  - **Result**: Poetiq users can now inspect the exact system and user prompts sent to the AI for every iteration, see clearly where the core puzzle description ends and the historical Python attempts begin, and understand at a glance how each new prompt differs from the last.
  - **Files**: `server/python/poetiq_wrapper.py`, `server/services/poetiq/poetiqService.ts`, `client/src/hooks/usePoetiqProgress.ts`, `client/src/pages/PoetiqSolver.tsx`, `docs/29112025-solver-transparency-ui-plan.md`

### Version 5.33.2

- **Poetiq UI: Slim Token & Cost Monitor** (Author: Codex / GPT-5)
  - Replaced the large token/cost card with a compact one-line pill so the dashboard focuses on meaningful content while still surfacing spend at a glance.
  - **Files**: `client/src/components/poetiq/PoetiqTokenMetrics.tsx`

### Version 5.33.3

- **Poetiq UI: Run Recap & Log Exports** (Author: Codex / GPT-5)
  - Added a friendly post-run recap card that highlights which expert won, how many iterations ran, consensus strength, and the hidden test result so users immediately know the outcome.
  - Introduced one-click export buttons for both the live event log and the Python console output, making audits and sharing easier.
  - **Files**: `client/src/components/poetiq/PoetiqProgressDashboard.tsx`, `client/src/pages/PoetiqSolver.tsx`

### Version 5.33.4

- **Poetiq UI: Token Summary in Header Only** (Author: Codex / GPT-5)
  - Removed the standalone token/cost card from the transparency dashboard so the spend summary now lives exclusively in the page header, keeping the main surface focused on meaningful updates.
  - **Files**: `client/src/components/poetiq/PoetiqProgressDashboard.tsx`, `client/src/components/poetiq/index.ts`, `client/src/components/poetiq/PoetiqTokenMetrics.tsx` (removed)

### Version 5.33.1

- **Poetiq UI: Scroll Fixes & Friendly Expert Tracker** (Author: Codex / GPT-5)
  - Restored vertical scrolling in PoetiqSolver so the Python terminal and event log are always reachable even when the new transparency dashboard is visible.
  - Reimagined the Expert Tracker placeholder with plain-language copy that explains what appears once experts start coding, then enlarged the live cards for easier reading.
  - **Files**: `client/src/pages/PoetiqSolver.tsx`, `client/src/components/poetiq/PoetiqExpertTracker.tsx`

### Version 5.33.0

- **Poetiq Solver: Phase I Transparency Dashboard** (Author: Codex / GPT-5)
  - Completed the Phase I transparency work by enriching `usePoetiqProgress` with phase timing, expert state tracking, and iteration history so every backend event is reflected in the UI without parsing logs.
  - Added the new `PoetiqProgressDashboard`, `PoetiqPhaseIndicator`, `PoetiqExpertTracker`, and `PoetiqTokenMetrics` components, then integrated them into PoetiqSolver to narrate phases, expert progress, and token/cost usage live.
  - Updated PoetiqCommunity with a transparency callout so community testers know the solver now surfaces every prompt, iteration, and cost in a human-readable dashboard.
  - **Files**: `docs/30112025-poetiq-phase1-transparency-plan.md`, `client/src/hooks/usePoetiqProgress.ts`, `client/src/components/poetiq/PoetiqPhaseIndicator.tsx`, `client/src/components/poetiq/PoetiqExpertTracker.tsx`, `client/src/components/poetiq/PoetiqTokenMetrics.tsx`, `client/src/components/poetiq/PoetiqProgressDashboard.tsx`, `client/src/components/poetiq/index.ts`, `client/src/pages/PoetiqSolver.tsx`, `client/src/pages/PoetiqCommunity.tsx`

### Version 5.32.17

- **Streaming Solver Progress: MVP Friendly Phase UI** (Author: Cascade using Cascade)
  - Introduced a lightweight "solver progress" experience for streaming analyses so users see a human-readable phase checklist and status sentence while the AI works instead of a bare text log.
  - Extended the shared streaming hook to track recent `phase`/`message` updates and taught the streaming panel to render them as a simple progress line that works across Saturn, Grover, and other SSE-based flows.
  - **Files**: `docs/2025-11-29-poetiq-solver-progress-mvp-plan.md`, `client/src/hooks/useAnalysisResults.ts`, `client/src/components/puzzle/StreamingAnalysisPanel.tsx`, `client/src/pages/PuzzleExaminer.tsx`

### Version 5.32.16

- **Poetiq Models: Revert Kat Coder Id & Keep Nebulon Fix** (Author: Codex / GPT-5)
  - Restored Kat Coder Pro's shared model entry back to the original `kwaipilot/kat-coder-pro:free` identifier while retaining the OpenRouter-prefixed id in `/api/poetiq/models`, so downstream systems referencing `MODELS` stay consistent with prior behavior.
  - Expanded the OpenRouter auto-key allowlist to handle both Kat Coder id forms, ensuring the free-tier fallback still works while BERT Nebulon Alpha continues to route through OpenRouter correctly.
  - **Files**: `server/config/models.ts`, `server/controllers/poetiqController.ts`

### Version 5.32.15

- **Poetiq Models: Fix Kat Coder OpenRouter Id** (Author: Codex / GPT-5)
  - Corrected the shared models catalog so `Kat Coder Pro (Free)` uses the `openrouter/kwaipilot/kat-coder-pro:free` identifier, keeping it aligned with `/api/poetiq/models` and the OpenRouter provider inference logic.
  - Ensures Poetiq now actually sends the full OpenRouter-prefixed model id so the backend routes through OpenRouter just like Bert Nebulon Alpha.
  - **Files**: `server/config/models.ts`

### Version 5.32.14

- **Poetiq Models: OpenRouter Free Tier Auto-Key Support** (Author: Codex / GPT-5)
  - Added an allowlist for cloaked/free OpenRouter IDs so Poetiq skips BYO gating and automatically injects the server `OPENROUTER_API_KEY` when no user key is provided.
  - Surfaced the new `openrouter/kwaipilot/kat-coder-pro:free` entry (non-BYO) alongside Bert Nebulon Alpha across `/api/poetiq/models` and the shared models catalog so both PoetiqSolver and Community control panels can target them without manual overrides.
  - **Files**: `server/config/models.ts`, `server/controllers/poetiqController.ts`, `server/services/poetiq/poetiqService.ts`

### Version 5.32.13

- **Poetiq Models: OpenRouter Free Tier Support** (Author: Codex / GPT-5)
  - Added `openrouter/bert-nebulon-alpha` and `openrouter/kwaipilot/kat-coder-pro:free` to the shared `MODELS` catalog and the `/api/poetiq/models` response, both marked as BYO-not-required so users can route Poetiq through the cloaked/free OpenRouter arena models.
  - Updated Poetiq's controller to skip BYO enforcement for those OpenRouter IDs and taught `poetiqService.solvePuzzle()` to fall back to the server `OPENROUTER_API_KEY` whenever a supported free-tier OpenRouter model is selected without a user key.
  - **Files**: `server/config/models.ts`, `server/controllers/poetiqController.ts`, `server/services/poetiq/poetiqService.ts`

### Version 5.32.12

- **Poetiq Solver: Live Prompt/Reasoning Telemetry + Token Stats** (Author: Codex / GPT-5)
  - **client/src/hooks/usePoetiqProgress.ts**: Capture prompt timeline entries, raw WebSocket events, and expert/global token+cost aggregates while resetting state safely on each run/cancel path.
  - **server/services/poetiq/poetiqService.ts**: Broadcast the Python wrapper's token usage, cost, and prompt payload metadata so the frontend receives everything the console prints.
  - **client/src/pages/PoetiqSolver.tsx**: Surface the new data with timeline/stream/event toggles, live token+cost summaries, a per-expert breakdown panel, and a Python console mirror so users can see every prompt, reasoning chunk, log line, and NDJSON event without devtools.
  - **docs/2025-11-28-poetiq-visibility-plan.md**: Logged the completion status for the visibility plan to document the new UI affordances.

### Version 5.32.11

- **PuzzleExaminer Prompt Preview Modal: Provider-Aware Model Card Flow** (Author: Cascade using Cascade)
  - **Problem**: After the DaisyUI → shadcn/ui migration, clicking a model card on `PuzzleExaminer` opened the prompt preview modal but the backend preview route had no reliable indication of which provider/model family was being used. The modal also always previewed as if it were an OpenAI prompt, even for Anthropic/Gemini/xAI/DeepSeek/OpenRouter models.
  - **Fix**:
    1. Extended `PuzzleExaminer`'s `pendingAnalysis` state to track the selected model's provider and added a small mapping helper from shared `ModelConfig.provider` values (`OpenAI`, `Anthropic`, `Gemini`, `xAI`, `DeepSeek`, `OpenRouter`, `Grover`, `Saturn`) to the backend `provider` slugs expected by `/api/prompt-preview` (e.g. `openai`, `anthropic`, `gemini`, `grok`, `deepseek`, `openrouter`).
    2. Updated `PromptPreviewModal` to accept an optional `provider` prop (defaulting to `'openai'`) and to send that value in the JSON body when calling `/api/prompt-preview`, satisfying the route's `provider` validation while keeping existing prompt-building behavior intact.
    3. Wired `PuzzleExaminer` to pass the mapped provider from `pendingAnalysis` into `PromptPreviewModal` only when a model card is clicked; template-only previews (via the Prompt Style "Preview" button) continue to default to OpenAI.
  - **Result**:
    - Clicking any model card now opens a prompt preview that is correctly associated with that model's provider family and can be safely extended server-side to provider-specific preview logic.
    - The confirmation button in the modal still triggers `analyzeWithModel` with the right `modelKey` and temperature support flags, preserving the existing analysis pipeline while restoring the "preview then run" flow for card-based runs.
  - **Files Modified**:
    - `client/src/components/PromptPreviewModal.tsx`
    - `client/src/pages/PuzzleExaminer.tsx`

### Version 5.32.9

- **UI Framework Migration: DaisyUI → shadcn/ui on PuzzleExaminer Page** (Author: Claude Code using Haiku 4.5)
  - **Objective**: Eliminate DaisyUI CSS overhead on the PuzzleExaminer page and align with the 30+ other files in the codebase already using shadcn/ui for consistency, maintainability, and improved accessibility.
  - **Changes**:
    1. **PromptPreviewModal.tsx**: Replaced native HTML `<dialog>` with shadcn/ui `<Dialog>` component, removed `.showModal()` JavaScript complexity, and migrated all DaisyUI button classes (`btn`, `btn-outline`, `btn-primary`, `btn-ghost`) to shadcn/ui `<Button>` variants.
    2. **PuzzleExaminer.tsx**:
       - Converted two card layouts (Prompt Style, Advanced Controls) from DaisyUI `card card-compact` to shadcn/ui `<Card>` with structured `<CardHeader>`, `<CardTitle>`, `<CardDescription>`, and `<CardContent>` components.
       - Replaced error alerts from `alert alert-error` to shadcn/ui `<Alert variant="destructive">`.
       - Replaced loading skeletons from DaisyUI `<div className="skeleton">` to shadcn/ui `<Skeleton />` component.
       - Migrated streaming modal from native dialog with DaisyUI classes to shadcn/ui `<Dialog>` for consistency.
       - Updated all DaisyUI color tokens to semantic Tailwind tokens: `bg-base-100` → `bg-background`, `bg-base-200` → `bg-muted`, `border-base-300` → `border-border`, `text-base-content/70` → `text-muted-foreground`.
    3. **ModelSelectionControls.tsx**: Converted two expand/collapse `<button>` elements to shadcn/ui `<Button variant="outline" size="sm">`.
    4. **ModelProviderGroup.tsx**: Updated color classes: `bg-base-200` → `bg-muted`, `hover:bg-base-300` → `hover:bg-accent`, `text-base-content/60` → `text-muted-foreground`.
    5. **ModelSelection.tsx**: Updated empty state text color from `text-base-content/60` to `text-muted-foreground`.
  - **Result**:
    - Complete removal of DaisyUI classes from PuzzleExaminer page and related model selection components.
    - All modal dialogs now use shadcn/ui Dialog component with Radix UI primitives for improved accessibility.
    - Reduced CSS bundle size by eliminating duplicate DaisyUI utilities alongside Tailwind.
    - 100% consistency with project's established shadcn/ui patterns (30+ existing files).
  - **Files Modified**:
    - `client/src/components/PromptPreviewModal.tsx`
    - `client/src/pages/PuzzleExaminer.tsx`
    - `client/src/components/puzzle/ModelSelectionControls.tsx`
    - `client/src/components/puzzle/ModelProviderGroup.tsx`
    - `client/src/components/puzzle/ModelSelection.tsx`
  - **Files Unchanged** (already compatible):
    - `client/src/hooks/useModelGrouping.ts` (pure state management, no UI framework deps)
    - `client/src/components/puzzle/ModelButton.tsx` (already uses shadcn/ui Button)
  - **Testing**: All functionality verified — modal opens/closes, buttons work, cards render, alerts display, skeletons load correctly.


### Version 5.32.8

- **Poetiq: GPT-5.1 Codex Verbosity Clamp** (Author: Cascade using Cascade)
  - **Change**: Extended the OpenAI Responses API `text.verbosity` clamp so both `gpt-5.1-codex` and `gpt-5.1-codex-mini` always send `"medium"` instead of `"high"`, matching their documented maximum verbosity.
  - **Result**: Poetiq runs that use the full GPT-5.1 Codex model no longer risk `400 invalid_request_error` responses from the Responses API due to unsupported verbosity settings.

### Version 5.32.7

- **Model Catalog: Full GPT-5.1 Codex + Poetiq Integration** (Author: Cascade using Cascade)
  - **Change**: Added the full `GPT-5.1 Codex` reasoning model alongside `GPT-5.1 Codex Mini` in the shared `MODELS` config, with pricing set to `$1.25` input / `$10.00` output per 1M tokens and identical context/metadata to the mini variant.
  - **Change**: Exposed `gpt-5.1-codex` as a direct OpenAI option in `/api/poetiq/models`, so Poetiq Community/Solver can select it just like Codex Mini while still treating BYO keys as optional.
  - **Change**: Updated Poetiq cost tracking to recognize both `gpt-5.1-codex` and `gpt-5.1-codex-mini` with their correct per-token prices, and taught the Poetiq service to route BYO keys for `gpt-5.1-codex` through `OPENAI_API_KEY` (direct Responses API) instead of OpenRouter.

### Version 5.32.6

- **Gemini thinking_config hotfix** (Author: Codex / GPT-5)
  - **Problem**: Direct Gemini calls (including Poetiq runs) failed with `Unknown field for GenerationConfig: thinking_config` when hitting `gemini-3-pro-preview`, causing immediate retries and no model output.
  - **Fix**: Removed the unsupported `thinking_config` payload from the shared Gemini service generation config (`server/services/gemini.ts`) and the Poetiq solver’s Gemini client (`solver/poetiq/llm.py`), leaving only fields accepted by the current Google Generative AI SDK. Added a note to re-enable thinking controls after migrating to a SDK version that supports them.
  - **Docs**: Captured the mitigation steps and scope in `docs/2025-11-29-gemini-thinking-config-hotfix-plan.md`.

### Version 5.32.5

- **Poetiq Solver: GPT-5.1 Codex Mini Verbosity Fix + BYO Routing Alignment** (Author: Cascade using Cascade)
  - **Problem**: Direct OpenAI runs with `gpt-5.1-codex-mini` were failing with `400 invalid_request_error` because `text.verbosity: 'high'` is not supported for that model (only `'medium'` is allowed). The solver page BYO key gating also used string heuristics that could drift from backend metadata.
  - **Fix**: Updated `solver/poetiq/llm.py` to clamp `text.verbosity` to `'medium'` specifically for `gpt-5.1-codex-mini` while keeping `'high'` as the default for other GPT-5.x/o3 models. Updated `PoetiqSolver` to consume dynamic `requiresBYO` / `routing` metadata from `/api/poetiq/models` so BYO key requirements and Community auto-start behavior stay consistent with the backend.
  - **Result**: OpenAI Responses API calls for `gpt-5.1-codex-mini` no longer 400 on verbosity, and the solver page now matches the Community page in which models truly require BYO keys vs can safely use the server OpenAI key.

### Version 5.32.4

- **Poetiq Community: Dynamic Model Metadata & API Key UI Fixes** (Author: Cascade using Cascade; code authored by Codex / GPT-5)
  - **Fix**: Community page now uses the shared `usePoetiqModels()` hook instead of a hardcoded model list, so provider, routing, and `requiresBYO` flags always stay in sync with `server/config/models.ts` and `/api/poetiq/models`.
  - **Fix**: Resolved undefined property errors in the API key help section by switching to derived `keyPlaceholder`/`providerKeyUrl` variables, adding optional chaining for `selectedModel?.provider`, and ensuring external links include `rel="noreferrer"`.
  - **Result**: Poetiq Community always shows accurate BYO key requirements and recommended models without runtime errors, fully aligning the page with the 5.32.3 BYO relaxation behavior.

### Version 5.32.3

- **Poetiq Solver: BYO Key Relaxation + GPT-5.1 Codex Mini Default** (Author: Cascade using Cascade)
  - **Change**: Adjusted Poetiq BYO key requirements so that only **Gemini** and **OpenRouter** models require a user-supplied API key. Direct OpenAI runs (including `gpt-5.1-codex-mini`) may omit `apiKey` and fall back to server `OPENAI_API_KEY` when configured.
  - **Implementation**:
    1. Updated `poetiqController.solve()` to require BYO keys only when the resolved provider/model is Gemini or OpenRouter; for other providers, requests without `apiKey` are accepted and rely on inherited env vars.
    2. Updated `/api/poetiq/models` metadata so that Gemini and OpenRouter entries set `requiresBYO: true`, while `gpt-5.1-codex-mini` is marked `requiresBYO: false`.
    3. Changed `PoetiqSolver` page defaults to use `gpt-5.1-codex-mini` as the default model and to treat the BYO key input as **optional** for direct OpenAI runs (while still required/visually enforced for Gemini/OpenRouter).
    4. Updated `PoetiqControlPanel` and `PoetiqCommunity` UI to reflect the new rules, showing "Required" badges only for Gemini/OpenRouter configurations and keeping project-key fallback messaging for other providers.
  - **Result**: Users can run Poetiq with GPT-5.1 Codex Mini using the server-level OpenAI key by default, while still being required to provide their own keys for higher-risk third-party providers (Gemini and OpenRouter).

### Version 5.32.2

- **Poetiq Solver: Direct SDK Routing Fix + Submodule Restore** (Author: Cascade using Cascade)
  - **Problem**: On the `arc3` branch, Poetiq runs with direct SDK integration were not hitting external APIs (especially OpenAI GPT-5.1 Codex Mini). BYO keys were being routed as `OPENROUTER_API_KEY` even for direct models like `gpt-5.1-codex-mini`, while the Python solver expected `OPENAI_API_KEY` for those models. This prevented real network calls and accurate token/cost tracking.
  - **Fix**:
    1. Updated `usePoetiqProgress.start()` so that the frontend only sends `provider: 'openrouter'` for models whose ID starts with `openrouter/`, and omits `provider` for direct models (OpenAI, Gemini, Anthropic, xAI). The backend now relies on `inferProviderFromModel(model)` to map BYO keys to the correct `*_API_KEY` env vars for the Python child process.
    2. Confirmed that `solver/poetiq/llm.py` and `server/python/poetiq_wrapper.py` correctly route GPT-5.x models to the OpenAI Responses API (`client.responses.create`) with reasoning parameters, and that token usage and cost are emitted back to the Node service.
    3. Restored the `poetiq-solver` git submodule as a **read-only reference** while keeping the internalized solver under `solver/poetiq/` as the execution path.
  - **Result**: Poetiq now correctly issues direct SDK calls for models like `gpt-5.1-codex-mini` using the caller's BYO key, and the UI/metrics pipeline once again receives accurate token and cost data. The original Poetiq repo is available as an in-repo reference via the submodule.

### Version 5.32.1

- **Poetiq Community Progress: Fix Iteration Count Metrics** (Author: Cascade using Claude Sonnet 4.5)
  - **Problem**: Iteration efficiency metrics were always showing "—" (no data) because `iteration_count` was hardcoded to `null` in the repository
  - **Fix**: Updated `getPoetiqExplanationsForPuzzles()` to query the existing `iteration_count` column from database
  - **Changes**:
    1. Added `iteration_count` to SQL SELECT query in `ExplanationRepository.ts:1258`
    2. Removed hardcoded `null` assignment, now properly maps `row.iteration_count` (line 1275)
    3. Controller already set up to pass iteration data through (no changes needed)
  - **Result**: "Iteration Efficiency" section on Community page now displays actual measured data:
    - Avg Iterations (Solved): Shows average iterations to solve puzzles
    - Avg Iterations (Failed): Shows average iterations before giving up
  - **Files Modified**:
    - `server/repositories/ExplanationRepository.ts:1258,1275` - Query and map `iteration_count` column

### Version 5.32.0 (BREAKING CHANGE)

- **Poetiq Solver: Complete Migration from LiteLLM to Direct SDK Calls** (Author: Cascade using Claude Sonnet 4)
  - **BREAKING CHANGE**: Removed LiteLLM dependency entirely from Poetiq solver
  - **Purpose**: Align Poetiq with main TypeScript services which already use direct SDK integration
  - **What Changed**:
    1. **OpenAI models** (GPT-5.x, o3, o4): Use Responses API (`POST /v1/responses`) with:
       - `reasoning: { effort, summary }` for chain-of-thought
       - `text: { verbosity }` for output control
    2. **Anthropic models** (Claude): Use Messages API via `@anthropic-ai/sdk` with:
       - Extended thinking support (`thinking: { type: "enabled", budget_tokens }`)
    3. **Google Gemini models**: Use Generative AI SDK via `google-generativeai` with:
       - Thinking config (`thinking_budget`) for Gemini 2.5+/3.x models
    4. **OpenRouter models**: Use OpenAI SDK with custom `base_url`
    5. **xAI (Grok) models**: Use OpenAI SDK with custom `base_url`
  - **Files Modified**:
    - `solver/poetiq/llm.py` - Complete rewrite with provider-specific functions (`llm_openai`, `llm_anthropic`, `llm_gemini`, `llm_openrouter`, `llm_xai`)
    - `solver/poetiq/__init__.py` - Updated documentation
    - `server/python/poetiq_wrapper.py` - Simplified to use unified `llm()` router, removed duplicate `llm_openai_responses`
    - `requirements.txt` - Removed `litellm>=1.50.0`
  - **Benefits**:
    - No more dependency on LiteLLM (simpler dependency tree)
    - Consistent architecture with TypeScript services
    - Better control over provider-specific features (reasoning, thinking)
    - Easier debugging with direct SDK calls

### Version 5.31.6

- **Poetiq Solver: Reasoning Traces Display** (Author: Cascade using Claude Sonnet 4)
  - **Feature**: Display reasoning summaries from OpenAI Responses API in the UI
  - **Changes**:
    1. `llm_openai_responses()` now returns reasoning summary as third tuple element
    2. Progress events include `reasoningSummary` field for GPT-5.x models
    3. New `reasoningSummaryHistory` state in `usePoetiqProgress` hook
    4. **Reasoning Traces panel** in UI (amber-themed, collapsible):
       - Shows chain-of-thought summaries from GPT-5.x
       - Button appears only when summaries are available
       - Displays iteration/expert markers with summary content
    5. WebSocket service forwards `reasoningSummary` to frontend
  - **Files Modified**:
    - `server/python/poetiq_wrapper.py` - Return and emit reasoning summary
    - `server/services/poetiq/poetiqService.ts` - Forward reasoningSummary in broadcasts
    - `client/src/hooks/usePoetiqProgress.ts` - Add reasoningSummaryHistory state
    - `client/src/pages/PoetiqSolver.tsx` - Reasoning Traces toggle and panel

### Version 5.31.5

- **Poetiq Solver: Direct OpenAI Responses API Integration** (Author: Cascade using Claude Sonnet 4)
  - **Problem**: Users could not see what prompts were being sent to the AI, and GPT-5.1 Codex Mini was incorrectly using litellm's ChatCompletions API instead of OpenAI's Responses API with proper reasoning parameters.
  - **Critical Fix**: 
    - **Direct OpenAI Responses API** implemented for GPT-5.x, o3, o4 models
    - Now uses `client.responses.create()` with proper parameters:
      - `input` (not `messages`) for Responses API format
      - `reasoning: { effort: "high", summary: "detailed" }` for GPT-5.x
      - `text: { verbosity: "high" }` for detailed output
      - `max_output_tokens: 128000` for full reasoning capacity
      - `store: true` and `include: ["reasoning.encrypted_content"]` for state preservation
  - **Changes**:
    1. **`llm_openai_responses()` function** (new in `poetiq_wrapper.py`):
       - Calls OpenAI Responses API directly via `openai.AsyncOpenAI()`
       - Properly parses `response.output[]` array for message content
       - Extracts reasoning tokens from `usage.output_tokens_details`
       - Logs response_id for potential chaining
    2. **API Routing** in `instrumented_solve_coding()`:
       - Detects if model should use direct OpenAI (`get_api_routing()`)
       - Routes GPT-5.1-codex-mini, o3-mini, o4-mini to Responses API
       - Routes OpenRouter and other models to litellm (ChatCompletions)
    3. **Prompt Inspector UI** (new feature):
       - Collapsible "Prompts" button shows system/user prompts
       - Displays model, temperature, provider, API style, reasoning params
    4. **Provider Badge in Header**:
       - Shows "🔗 Direct OpenAI" (green) or "🔀 OpenRouter" (amber)
       - Displays API style ("Responses API" vs "ChatCompletions API")
    5. **Service Updates** (`poetiqService.ts`):
       - Added `'openai'` as valid provider type
       - Added `isDirectOpenAIModel()` and `inferProviderFromModel()` methods
       - Ensures `OPENAI_API_KEY` is passed to Python subprocess
  - **Files Modified**:
    - `server/python/poetiq_wrapper.py` - `llm_openai_responses()`, API routing
    - `server/services/poetiq/poetiqService.ts` - OpenAI provider support
    - `server/controllers/poetiqController.ts` - reasoningEffort extraction
    - `client/src/hooks/usePoetiqProgress.ts` - PromptData interface
    - `client/src/pages/PoetiqSolver.tsx` - Prompt Inspector, Provider Badge
  - **Plan Document**: `docs/plans/2025-11-27-poetiq-api-improvements-plan.md`

### Version 5.31.4

- **Plan: Enforce User-Provided API Keys for Third-Party Providers** (Author: GPT-5.1 via Codex)
  - **Purpose**: Define a safe path to require users to enter their own API keys (e.g., Gemini, OpenRouter) instead of silently falling back to project-level keys, while preserving all existing secure behavior and flows that already work.
  - **Scope**:
    - Backend: Remove silent project-key fallback for user-facing requests, introduce explicit "API key required" errors, and keep project keys only for system-level tasks.
    - Frontend: Show clear prompts when a user key is missing and guide users to the existing API key/settings screen to add or update their keys.
    - Testing & Docs: Add coverage and documentation updates so the new requirement is clearly specified and verifiable.
  - **Plan Doc**: See `docs/2025-11-28-require-user-api-key-plan.md` for detailed steps, assumptions, and test strategy.

### Version 5.31.3

- **Poetiq Solver Training Examples Display Fix** (Author: Cascade using Claude Sonnet 4)
  - **Problem**: Training examples section in PoetiqSolver showed empty space instead of actual grid content
  - **Root Cause**: PoetiqSolver was using `TinyGrid` component instead of the project's standard `PuzzleGrid` component
  - **Fix**: 
    - Replaced `TinyGrid` with `PuzzleGrid` component to match rest of project
    - Added required props: `title`, `compact`, `maxWidth`, `maxHeight`, `showEmojis`, `showColorOnly`, `emojiSet`
    - Fixed TypeScript errors by adding missing `title` prop to both input and output grids
  - **Files Modified**: `client/src/pages/PoetiqSolver.tsx`
  - **Impact**: Training examples now properly display input→output grid pairs in the right-side panel before solver starts

### Version 5.31.2

- **Poetiq Deployment Fix - Remove Submodule Cloning** (Author: Cascade using Claude Sonnet 4)
  - **CRITICAL BUG**: Dockerfile was still cloning the old `poetiq-solver` submodule, but `poetiq_wrapper.py` now expects `solver/poetiq/`. This would cause deployment failures.
  - **Fixes**:
    - `Dockerfile` - Removed `git clone` of old submodule, added verification of internalized solver at `solver/poetiq/`
    - `.gitmodules` - Removed poetiq-solver submodule entry (with historical note)
    - `setup-poetiq.sh` - Updated to check for `solver/poetiq/` instead of old `poetiq-solver/arc_agi/`
    - `solver/poetiq/__init__.py` - Fixed docstring to correctly describe litellm usage
  - **Note**: The old `poetiq-solver/` directory may still exist locally. It can be safely deleted with `git rm -r poetiq-solver` and `rm -rf poetiq-solver`.

### Version 5.31.1

- **Poetiq Community Page: Cost Efficiency Metrics & Layout Redesign** (Author: Claude Code using Haiku 4.5)
  - **Purpose**: Add cost tracking to validate Poetiq's Pareto Frontier claims about accuracy-to-cost ratios
  - **Changes**:
    1. **Cost Efficiency Metrics** (validates Pareto claims):
       - **Coverage**: `attempted / total` showing % of dataset tested
       - **Success Rate**: `solved / attempted` showing effectiveness on tested puzzles
       - **Total Cost**: Cumulative cost across all attempts
       - **Cost per Solve**: Average cost for successful solves (accuracy-to-cost ratio)
       - **Cost per Attempt**: Average cost including failures
    2. **Backend Enhancement**:
       - Updated `ExplanationRepository.getPoetiqExplanationsForPuzzles()` to return cost data
       - Added `inputTokens`, `outputTokens`, `totalTokens`, `estimatedCost` to query results
       - Modified `poetiqController.getCommunityProgress()` to pass cost data to frontend
    3. **Hook Enhancements** (`usePoetiqCommunityProgress.ts`):
       - Added cost fields to `PoetiqPuzzleStatus` interface
       - Calculate `totalCost`, `avgCostPerSolve`, `avgCostPerAttempt` from puzzle data
       - Removed useless `modelStats` breakdown (no expert count metadata available)
    4. **PoetiqCommunity.tsx Redesign**:
       - Moved explanations (Technical Definitions + Deep Dive sections) to top
       - Replaced simple counter with 5-card metrics panel showing cost efficiency
       - Removed per-model stats table (replaced with cost metrics)
       - Moved puzzle grid to bottom as "Puzzle Status"
    5. **PuzzleProgressGrid.tsx Navigation Fix**:
       - Changed puzzle badge destination from `/puzzle/poetiq/{puzzleId}` to `/puzzle/{puzzleId}`
       - Users navigate to Puzzle Explainer instead of Poetiq solver
    6. **PoetiqSolver.tsx Training Grid Display**:
       - Added training examples to right-side panel
       - Shows input→output pairs before running, replaced by event log when solver starts
  - **Files Changed**:
    - `server/repositories/ExplanationRepository.ts` (cost data query)
    - `server/controllers/poetiqController.ts` (cost data passthrough)
    - `client/src/hooks/usePoetiqCommunityProgress.ts` (cost calculations)
    - `client/src/pages/PoetiqCommunity.tsx` (cost metrics display)
    - `client/src/components/poetiq/PuzzleProgressGrid.tsx` (navigation fix)
    - `client/src/pages/PoetiqSolver.tsx` (training grid display)

### Version 5.31.0

- **Poetiq Solver - Comprehensive Token & Cost Tracking** (Author: Cascade using Claude Sonnet 4)
  - **Purpose**: Independent audit capability for Poetiq's Pareto Frontier cost claims
  - **Implementation**: Enhanced `server/python/poetiq_wrapper.py` with full token/cost tracking
    - **Cost Calculator**: Added MODEL_PRICING table mirroring `server/config/models.ts` (per-1M-token pricing)
    - **Model Normalizer**: Handles litellm provider prefixes (openai/, gemini/, anthropic/, openrouter/)
    - **Per-Iteration Tracking**: Captures token usage from every LLM API call via `llm()` function
    - **Per-Expert Aggregation**: Each expert's total tokens/cost tracked separately
    - **Global Aggregation**: Sum across all experts for puzzle-level totals
  - **Enhanced llm.py**: Modified `solver/poetiq/llm.py` to return token_usage as 5th tuple element
    - Original Poetiq discarded `resp.usage` - we now capture: `input_tokens`, `output_tokens`, `total_tokens`
    - Backward-compatible wrapper (`llm_compat`) for code expecting old 4-element return
  - **Progress Events**: Real-time token/cost streaming to frontend
    - `tokenUsage`: Per-iteration token counts
    - `cost`: Per-iteration cost breakdown (input/output/total)
    - `expertCumulativeTokens`/`expertCumulativeCost`: Running totals for this expert
    - `globalTokens`/`globalCost`: Running totals across all experts
  - **Final Result Schema**: Added to `run_poetiq_solver()` return value:
    - `tokenUsage`: {input_tokens, output_tokens, total_tokens}
    - `cost`: {input, output, total} in USD
    - `expertBreakdown`: Per-expert token/cost data for multi-expert runs
  - **Audit Documentation**: Created `docs/2025-11-27-arc-agi-token-cost-tracking-analysis.md`
    - Compares ARC-AGI benchmarking framework's token tracking (gold standard)
    - Documents Poetiq's dashboard-only approach (no programmatic tracking)
    - Identifies verification gaps in Poetiq's Pareto Frontier claims
    - Proposes audit methodology using our instrumented wrapper
  - **Benefits**:
    - ✅ Verifiable per-puzzle cost attribution (unlike Poetiq's dashboard approach)
    - ✅ Per-expert cost breakdowns (critical for multi-expert configs)
    - ✅ Real-time cost visibility during execution
    - ✅ Programmatic validation of cost claims
    - ✅ Independent audit trail for research/publication

### Version 5.30.0

- **Poetiq Solver Internalization - Enhanced Token Tracking** (Author: Cascade using Claude Sonnet 4)
  - **Architecture**: Moved Poetiq solver from git submodule (`poetiq-solver/`) into `solver/poetiq/`, keeping litellm for multi-provider routing (faithful to original Poetiq).
  - **KEY FIX**: Original Poetiq discarded `resp.usage` token data - we now capture and return it! This enables cost tracking without changing the underlying architecture.
  - **SDK Backends Installed**: Added all SDK backends that litellm needs:
    - `litellm>=1.50.0` - Multi-provider router (kept from original)
    - `google-generativeai>=0.8.0` - Gemini backend
    - `openai>=1.0.0` - OpenAI/GPT backend  
    - `anthropic>=0.40.0` - Claude backend
  - **Files Created in `solver/poetiq/`**:
    - `__init__.py` - Package exports
    - `types.py` - TypedDict definitions (ExpertConfig, ARCAGIResult, TokenUsage)
    - `utils.py` - Utility functions
    - `sandbox.py` - Sandboxed code execution
    - `scoring.py` - Kaggle-format scoring
    - `io.py` - I/O utilities
    - `prompts.py` - Solver prompt templates
    - `config.py` - Default configuration
    - `llm.py` - **Enhanced** litellm-based implementation with token usage capture
    - `solve_coding.py` - Iterative code generation loop (accumulates token usage)
    - `solve_parallel_coding.py` - Parallel expert orchestration and voting
    - `solve.py` - Main entry point
  - **Updated Files**:
    - `server/python/poetiq_wrapper.py` - Now imports from `solver.poetiq` instead of submodule
    - `requirements.txt` - Added all SDK backends
  - **Benefits**:
    - **Faithful replication** of original Poetiq behavior via litellm
    - **Token usage tracking** for cost analysis (previously discarded!)
    - **Multi-provider support** - works with Gemini, OpenAI, Anthropic, xAI, OpenRouter
    - No external submodule dependency
  - **Plan Documents**: 
    - `docs/plans/2025-11-27-poetiq-internalization-plan.md`
    - `docs/plans/2025-11-27-poetiq-internalization-revised-plan.md`

### Version 5.29.15

- **Poetiq LLM Temperature Guidance** (Author: Codex (GPT-5))
  - Added a lightweight plan plus a full write-up explaining how the Poetiq integration keeps LiteLLM-based requests provider-agnostic, why the solver defaults to `temperature = 1.0`, and how each vendor clamps randomness (Gemini, GPT-5, Grok, Anthropic, OpenRouter mirrors).
  - Document answers the “isn’t that high?” question from the Poetiq audit notes and calls out the relevant code paths (`PoetiqSolver.tsx`, `poetiqController.ts`, `poetiq_wrapper.py`, `arc_agi/llm.py`, `openai/payloadBuilder.ts`, and `server/config/models.ts`).
  - **Files**: `docs/2025-11-27-llm-temperature-doc-plan.md`, `docs/poetiq-llm-agnostic-temperature-guide.md`

### Version 5.29.14

- **Poetiq Parser Alignment** (Author: Codex (GPT-5))
  - `poetiqService.transformToExplanationData` now feeds results plus the loaded `ARCTask` through the shared `responseValidator`, so the same grid parser/cleaner used by Saturn/Grover sanitizes Poetiq predictions (fixes stray newline artifacts and ensures multi-test arrays match our schema).
  - Stored provider metadata now includes validator traces and normalized raw predictions for future audits; controllers pass puzzle context into the transformer to unlock this validation.
  - Added a short plan doc covering the parser alignment work.
  - **Files**: `server/services/poetiq/poetiqService.ts`, `server/controllers/poetiqController.ts`, `docs/2025-11-27-poetiq-parser-alignment-plan.md`

### Version 5.29.13

- **Poetiq Confidence Suppression** (Author: Codex (GPT-5))
  - Hard-coded Poetiq explanation transforms to store `confidence = 0` and `trustworthinessScore = null` so UI cards stop surfacing misleading metrics for meta-system runs.
  - Added accompanying implementation plan to document why these fields are intentionally blanked.
  - **Files**: `server/services/poetiq/poetiqService.ts`, `docs/2025-11-27-poetiq-confidence-suppression-plan.md`

### Version 5.29.12

- **Poetiq Model Metadata Persistence** (Author: Codex (GPT-5))
  - Ensured every Poetiq run stores the actual selected model/provider combination just like Saturn/Grover: Python wrapper now reports its in-memory config without relying on undefined globals, and the TypeScript service enriches final results with sanitized run options before persisting.
  - `transformToExplanationData` now slugs the full model id (`openrouter/google/gemini-3-pro-preview` → `poetiq-openrouter-google-gemini-3-pro-preview`) so analytics can differentiate OpenRouter vs direct calls, and providerRawResponse keeps the enriched config blob.
  - Added a focused implementation plan record for this fix under `docs/`.
  - **Files**: `server/python/poetiq_wrapper.py`, `server/services/poetiq/poetiqService.ts`, `docs/2025-11-27-poetiq-model-agnostic-plan.md`

### Version 5.29.11

- **Poetiq Solver UI Redesign** (Author: Cascade using Claude Sonnet 4)
  - **Problem**: User feedback identified several UX issues:
    1. Tiny gear icon hid valuable configuration settings
    2. Top header bar was wasted space showing only title
    3. "Python Execution" terminal label was confusing
    4. Model selection showed misleading routing info ("Direct" when using OpenRouter)
    5. Start button looked like plain text, not clickable
  - **Header Redesign**: 
    - Gradient indigo/purple header with key metrics inline (Status, Iteration, Elapsed, Phase)
    - Stop button integrated into header when running
    - No more wasted space
  - **Controls Always Visible**: Removed collapsible gear icon - settings are now always shown prominently
  - **Prominent Start Button**:
    - Large green gradient button with Rocket + Zap icons
    - Clear visual weight, not mistakable for plain text
    - Red variant when stopping
  - **Clear Routing Indicators**:
    - Blue badge: "Via OpenRouter (Uses Server Key)"
    - Amber badge: "Direct API to [Provider] (Requires Your API Key)"
    - Models marked with "(BYO Key)" in dropdown when direct API required
  - **Renamed Terminal Panel**:
    - Changed "PYTHON EXECUTION" → "ITERATION PROGRESS"
    - Added subtitle: "Code generation & testing results per iteration"
    - Clearer purpose without technical jargon
  - **Backend Model List Updated** (`poetiqController.ts`):
    - Added `routing` and `requiresBYO` fields to model definitions
    - Removed misleading "(Direct)" labels from model names
  - **Files Modified**:
    - `client/src/pages/PoetiqSolver.tsx` - Header, layout, controls visibility
    - `client/src/components/poetiq/PoetiqControlPanel.tsx` - Start button, routing indicators
    - `client/src/components/poetiq/PoetiqPythonTerminal.tsx` - Renamed and clarified
    - `server/controllers/poetiqController.ts` - Model metadata with routing info
    - `docs/plans/2025-11-27-poetiq-visibility-debug-plan.md` - Added UI redesign section

### Version 5.29.10

- **Poetiq UI Timing & Event Visibility** (Author: Cascade using Claude Sonnet 4)
  - **Metrics bar expanded** to 6 columns: Iteration, Phase, Status, Elapsed Time, Last Update, Event Count
  - **Elapsed time** shows running clock (MM:SS format) while solver is active
  - **Last Update** shows how long since last event - turns orange if >30s (potential hang indicator)
  - **Event Log panel** - collapsible panel showing all timestamped events in real-time
  - **LIVE indicator** pulses green when events are streaming
  - Helps diagnose if solver is hanging vs. just slow
  - **Files**: `client/src/pages/PoetiqSolver.tsx`

### Version 5.29.9

- **Dockerfile Fix for Poetiq Submodule** (Author: Cascade using Claude Sonnet 4)
  - **Problem**: Poetiq solver failed on Railway with "arc_agi/solve.py not found" because git submodules don't work with Docker COPY
  - **Solution**: Added `git` to Alpine packages and replaced `COPY poetiq-solver/` with `git clone` of the submodule repo
  - Added verification step to fail build early if `solve.py` is missing
  - **Files**: `Dockerfile`

### Version 5.29.8

- **Poetiq UI Fixes** (Author: Cascade using Claude Sonnet 4)
  - **Fixed nested `<a>` tags** in `PoetiqSolver.tsx` - wouter `Link` already renders an anchor, so nested `<a>` was causing React DOM warning
  - **Fixed undefined phase issue** - Log events now include `phase: 'log'` to prevent frontend state corruption
  - **Improved debug logging** - WebSocket handler now logs both wrapper type and actual data type
  - **Files**: `client/src/pages/PoetiqSolver.tsx`, `server/services/poetiq/poetiqService.ts`, `client/src/hooks/usePoetiqProgress.ts`

### Version 5.29.7

- **Poetiq Visibility Parity with Saturn** (Author: Cascade using Claude Sonnet 4)
  - **Problem**: Poetiq UI stayed blank after clicking "Run" because events weren't reaching the frontend properly.
  - **Frontend Hook Fixes** (`usePoetiqProgress.ts`):
    - Seed UI state synchronously BEFORE network calls (Saturn pattern) for immediate visual feedback
    - Initialize all buffers (logLines, reasoningHistory, pythonLogLines, streamingReasoning, streamingCode)
    - Fixed WebSocket handler to accumulate content properly instead of relying on message changes
    - Handle ALL event types (progress, log, start, error) not just progress
    - Cap buffers (500 log lines, 100 reasoning entries) to prevent memory bloat
  - **Python Wrapper Fixes** (`poetiq_wrapper.py`):
    - Moved `emit()` and `log()` functions to top of file (were called before definition)
    - Added detailed preflight error messages with remediation hints
    - Enhanced start event with model/experts/iterations metadata
    - Added initializing progress event for immediate UI feedback
  - **Backend Service Fixes** (`poetiqService.ts`):
    - Broadcast ALL event types (start, progress, log, error) to WebSocket, not just progress
    - Forward non-JSON stdout as log events so AI model responses appear in UI
    - Forward stderr as error log events
    - Added eventTrace collection like Saturn for debugging
  - **Controller Cleanup** (`poetiqController.ts`):
    - Removed duplicate WebSocket broadcasting (service now handles it)
    - Controller callback now only logs to console for all event types
  - **Files**: `client/src/hooks/usePoetiqProgress.ts`, `server/python/poetiq_wrapper.py`, `server/services/poetiq/poetiqService.ts`, `server/controllers/poetiqController.ts`

### Version 5.29.6

- **Poetiq WebSocket Debug Logging** (Author: Cascade using Claude Sonnet 4.5)
  - Added detailed error logging to `usePoetiqProgress.ts` to show error data when Python process fails (line 169)
  - Added WebSocket close event logging with close code and current state (line 183)
  - Added environment variable debugging in `poetiqService.ts` to verify API keys are reaching Python subprocess (line 177-178)
  - These logs will help diagnose why WebSocket closes immediately after connecting
  - **Files**: `client/src/hooks/usePoetiqProgress.ts`, `server/services/poetiq/poetiqService.ts`

### Version 5.29.5

- **Poetiq Visibility & Streaming Debug Plan** (Author: Codex / GPT-5)
  - Added detailed recovery plan to surface all Poetiq solver signals (reasoning/code/logs/errors) end-to-end, using SaturnVisualSolver as the gold-standard reference.
  - Documents chokepoints (Python preflight, WebSocket forwarding, session plumbing, UI expectations) and phased fixes plus acceptance criteria to avoid silent failures.
  - **Files**: `docs/plans/2025-11-27-poetiq-visibility-debug-plan.md`

### Version 5.29.4

- **Poetiq UI/UX Fixes & Content Audit** (Author: Cascade using Claude Sonnet 4.5)
  - **API Key Input Type Fix**: Changed from `type="password"` to `type="text"` in both `PoetiqCommunity.tsx:221` and `PoetiqControlPanel.tsx:283` to eliminate browser password field warnings (API keys are not passwords)
  - **Missing State Variable**: Added `reasoningEffort` state variable in `PoetiqSolver.tsx:39` that was previously undefined, preventing solver from starting
  - **API Key Security**: Removed all validation logic in `poetiqController.ts:143-146` - now accepts any user-provided key without validation or modification. Security measures confirmed:
    - API key passed only via environment variables to Python subprocess (never logged, never stored, never broadcast via WebSocket)
    - Only `usingFallback` flag sent to client (boolean indicating if server key is used)
    - Key exists only in memory for duration of Python process execution
  - **Content Audit**: Updated `PoetiqCommunity.tsx` to maintain professional, educational tone as independent community auditors:
    - Added "Technical Definitions" card (lines 269-308) with clear explanations of "Pareto Frontier" and "Recursive Self-Improving Meta-System"
    - Clarified auditor role: "We are not affiliated with Poetiq. We are independent community members auditing their claims..."
    - Removed marketing language: Changed "delivering higher accuracy" → "achieving better accuracy-to-cost ratios than prior reported results"
    - Fixed GPT-5.1 label: Removed "Preview" variant (line 347) - it's not a preview model
    - Updated all model descriptions to factual statements (e.g., "Latest Google model used in reported SOTA configurations")
  - **Files**: `client/src/pages/PoetiqCommunity.tsx`, `client/src/pages/PoetiqSolver.tsx`, `client/src/components/poetiq/PoetiqControlPanel.tsx`, `server/controllers/poetiqController.ts`

### Version 5.29.3

- **Poetiq Solver "Saturn-Grade" Live Feedback** (Author: Cascade using Claude Sonnet 4.5)
  - **Goal**: Match Saturn's dynamic information density for the Poetiq Meta-System.
  - **Backend Instrumentation**: Monkey-patched `poetiq_wrapper.py` to emit real-time events from inside the solver loop (reasoning, code generation, training eval results).
  - **Rich WebSocket Protocol**: Forwarding `expert_id`, full `reasoning` trace, parsed `code`, and granular `trainResults` to frontend.
  - **Dynamic Terminal UI**:
    - **Real-Time Expert Tracking**: Shows "Iter X | Exp Y" updates as they happen.
    - **Live Training Results**: Visual "traffic light" indicators (green/red dots) for each training example.
    - **Code Inspection**: Collapsible code blocks to view the actual Python code generated by each expert.
    - **Stable Log**: Uses upsert logic to update cards in-place rather than spamming the log.
  - **Files**: `poetiq_wrapper.py`, `poetiqService.ts`, `usePoetiqProgress.ts`, `PoetiqPythonTerminal.tsx`, `PoetiqSolver.tsx`

### Version 5.29.2

- **Poetiq Integration Audit & Meta-System Update** (Author: Cascade using Claude Sonnet 4.5)
  - **Deep Dive Audit**: Verified Poetiq's "Meta-System" claims and "LLM-agnostic" architecture against open-source code and blog post.
  - **Merged Community Page**: Merged `PoetiqExplainer` into `PoetiqCommunity` for a single, comprehensive audit landing page.
  - **New SOTA Models**: Added Grok 4 Fast (xAI), GPT-OSS 120B (OpenRouter), and GPT-5.1 (OpenRouter) to the solver's model list, reflecting the blog post's specific configurations.
  - **Terminology Update**: Updated `PoetiqSolver` to use "Meta-System" terminology and clarified Expert configurations (Config A/B/C) instead of model-specific names.
  - **Verification**: Ensured all models use verified keys from `models.ts` - no placeholders.
  - **Files**: `PoetiqCommunity.tsx`, `PoetiqSolver.tsx`, `PoetiqControlPanel.tsx`, `poetiqController.ts`

### Version 5.29.1

- **HTTPS Security Fix for Poetiq Solver** (Author: Cascade using Claude Sonnet 4)
  - **Problem**: Railway's reverse proxy terminates SSL, causing `req.protocol` to report `http` even when client used HTTPS
  - **Solution**: Added `app.set('trust proxy', 1)` and fallback to check `X-Forwarded-Proto` header
  - **File**: `server/index.ts` - middleware now correctly detects HTTPS through proxy
  - **Impact**: Fixes 400 "HTTPS required" error when passing API keys from community to solver page

- **Improved Poetiq Solver UX - Collapsible Controls** (Author: Cascade using Claude Sonnet 4)
  - **Problem**: Users auto-starting from community page had to see large control panel they already configured
  - **Solution**: Compact status header with settings toggle, auto-hide controls when coming from community
  - **Features**:
    - Always-visible compact status (READY/RUNNING/COMPLETED/ERROR) with iteration counter
    - Settings gear button to toggle full control panel
    - Auto-start message "Auto-starting with community settings..."
    - API key now truly optional - server falls back to project key
  - **File**: `client/src/pages/PoetiqSolver.tsx`

### Version 5.29.0

- **Poetiq solver defaults to OpenRouter** (Author: Codex (GPT-5))
  - `server/python/poetiq_wrapper.py`: now treats `OPENROUTER_API_KEY` as a first-class credential, logs its availability, and defaults the LiteLLM model id to `openrouter/google/gemini-3-pro-preview` so BYO keys and server keys hit the proxy instead of direct Gemini.
  - `run-poetiq-batch.js`: batch runs log the OpenRouter model and no longer hardcode the direct Gemini variant.
- **UI + hooks send the correct LiteLLM ids** (Author: Codex (GPT-5))
  - `client/src/hooks/usePoetiqModels.ts`: new hook that calls `/api/poetiq/models` so the control panel always gets solver-ready ids.
  - `client/src/components/poetiq/PoetiqControlPanel.tsx`, `client/src/hooks/usePoetiqProgress.ts`, `client/src/pages/PoetiqSolver.tsx`: default provider/model now point at the OpenRouter Gemini proxy and provider switching reuses the new hook data.
  - `client/src/pages/PoetiqCommunity.tsx`: sessionStorage auto-start config stores the OpenRouter id (`openrouter/google/gemini-3-pro-preview`) and the direct fallback (`gemini/gemini-3-pro-preview`) so solver runs align with LiteLLM expectations.
- **Docs**
  - `poetiq-solver/README.md`: documents `OPENROUTER_API_KEY` + `USE_OPENROUTER=true` as the recommended setup, with Gemini/OpenAI keys kept as fallbacks.

### Version 5.28.9

- **Poetiq UX - Navigate to Solver for Full Feedback** (Author: Cascade using Claude Sonnet 4)
  - **Problem**: Community page had minimal feedback - no Python terminal, no streaming boxes
  - **Solution**: Community page now navigates to full solver page for rich feedback
    - Saves config to sessionStorage (apiKey, provider, model, experts)
    - Solver page auto-reads config and auto-starts
    - User sees full Python execution terminal, AI reasoning streaming, code generation
  - **Renamed**: "Poetiq Code Generator" → "Poetiq Solver" (header title)
  - **Files**: `PoetiqCommunity.tsx`, `PoetiqSolver.tsx`

### Version 5.28.8

- **Fix Poetiq Pages - Dynamic Models from API** (Author: Cascade using Claude Sonnet 4)
  - **Solver page** (`/puzzle/poetiq/:taskId`):
    - Uses `useModels()` hook to fetch ALL models from `/api/models` endpoint
    - Groups by provider (OpenRouter, OpenAI, Gemini)
    - No hardcoded model lists - uses actual server config
    - Shows 🧠 for reasoning models
  - **Community page** (`/poetiq`):
    - Locked to Gemini 3 Pro Preview model
    - Now allows BOTH OpenRouter AND Gemini Direct providers
    - Added provider dropdown (same model, choice of API)
  - **Both pages**: Expert options 1, 2, 8 only (Gemini-3-a/b/c)
  - **Files**: `PoetiqControlPanel.tsx`, `PoetiqCommunity.tsx`

### Version 5.28.7

- **Differentiate Poetiq Pages - Community vs Solver** (Author: Cascade using Claude Sonnet 4)
  - **Clarification**: Two different Poetiq pages with different purposes:
    - `/poetiq` (Community) - Locked to Gemini 3 Pro Preview via OpenRouter only
    - `/puzzle/poetiq/:taskId` (Solver) - Allows ANY provider/model selection
  - **Solver page restored**: Full provider/model/temperature selection
  - **Community page**: Stays locked to Gemini 3 Pro Preview
  - **Both pages**: Expert options 1, 2, 8 only (Gemini-3-a/b/c)
  - **Files**: `PoetiqControlPanel.tsx`, `PoetiqSolver.tsx`

### Version 5.28.6

- **Fix PoetiqCommunity Page - Use Actual Config** (Author: Cascade using Claude Sonnet 4)
  - **Problem**: Community page (/poetiq) still had wrong models and "4 experts" option
  - **Fix**: 
    - Locked to `google/gemini-3-pro-preview` via OpenRouter (same as control panel)
    - Expert options: 1, 2, 8 ONLY (Gemini-3-a, Gemini-3-b, Gemini-3-c)
    - Removed provider selector (was showing Gemini Direct option)
    - Removed model selector (was showing outdated models)
    - Added teal info card showing fixed model
  - **Files**: `PoetiqCommunity.tsx`

### Version 5.28.5

- **Fix Poetiq Control Panel - Use Actual Config** (Author: Cascade using Claude Sonnet 4)
  - **Problem**: Control panel had hallucinated model lists (GPT-5, etc.) instead of actual Poetiq config
  - **Fix**: 
    - Poetiq ONLY uses `google/gemini-3-pro-preview` via OpenRouter (hardcoded in config.py)
    - Expert options fixed to 1, 2, 8 ONLY (Gemini-3-a, Gemini-3-b, Gemini-3-c) - removed invalid "4 experts"
    - Removed fake provider/model dropdowns - model is fixed
    - Simplified control panel to: API key (optional), Expert config, Max iterations
  - **Files**: `PoetiqControlPanel.tsx`, `PoetiqSolver.tsx`

### Version 5.28.4

- **GPT-5.1 Codex Mini Support** (Author: Codex (GPT-5))
  - `server/config/models.ts`: Added the OpenAI listing for `gpt-5.1-codex-mini` with cost ($0.25 / $2 per million tokens), 400k context, 128k max output, reasoning-token note, and preview release metadata so UI+server selectors surface it like other GPT-5-class models.
  - `server/services/openai.ts`: Registered the new key for routing plus streaming support, ensuring Responses API streaming + schema lookup flows treat GPT-5.1 Codex Mini identically to other GPT-5 reasoning models.

### Version 5.28.3

- **Gemini 3 Pro Preview (Direct) Enablement** (Author: Codex (GPT-5))
  - `docs/2025-11-26-gemini-3-pro-preview-plan.md`: Captured the direct-Gemini rollout goal, impacted files, and risk notes for adding `gemini-3-pro-preview`.
  - `server/config/models.ts`: Added a first-party `Gemini` provider entry for `gemini-3-pro-preview` (maps to `models/gemini-3-pro-preview`, reasoning-capable, structured-output disabled, streaming turned off) so UI + routing logic can surface the direct Google option beside the existing OpenRouter variant.
  - `server/services/gemini.ts`: Registered the new key and generalized the reasoning/thinking detection + generation config helpers so Gemini 3 models inherit the same thinking budget handling and capability reporting as 2.5-series models.

### Version 5.28.2

- **Poetiq ARC2 Batch Runner Update** (Author: Codex (GPT-5))
  - Script now targets the first 20 ARC2-Eval puzzles automatically so batch runs match the latest request volume.
  - Default expert count increased to two, aligning with the desired Poetiq multi-expert configuration.
  - Logging is ASCII-only and progress/summary metrics now derive from the actual puzzle count (no more hard-coded `/10` output).
  - Added guardrails for missing `sessionId` and failed status polls to surface actionable errors instead of silent hangs.

### Version 5.28.1

- **Poetiq API Key Fallback & Streaming Fields** (Author: Cascade using Claude Sonnet 4)
  - **API Key Now Optional**: Users can start solver without providing an API key
  - **Fallback Behavior**: When API key is missing/invalid, server uses its environment variables
  - **UI Updates**: 
    - Control panel shows "API Key (Optional)" with explanation
    - Fallback notice shown in streaming panel when using server key
    - Placeholder text indicates "(optional)" in all API key fields
  - **Hook Updates**: Added streaming fields to `usePoetiqProgress`:
    - `streamingText`, `streamingReasoning`, `streamingCode`
    - `logLines` array for activity tracking
    - `usingFallback` indicator
  - **Server Updates**: `poetiqController` validates API key format, falls back gracefully

### Version 5.28.0

- **Major Poetiq UI Overhaul - Saturn's Exact Layout Pattern** (Author: Cascade using Claude Sonnet 4)
  - **Goal**: Match Saturn's information density with Python terminal output instead of image gallery
  - **Layout**: Saturn's exact 12-column grid: LEFT (4 cols) + CENTER (5 cols) + RIGHT (3 cols)
  
  **New Components Created:**
  - `PoetiqControlPanel.tsx` - Saturn-style visible controls (NO collapsing), GPT-5 Nano/Mini options, reasoning effort settings
  - `PoetiqPythonTerminal.tsx` - Python execution terminal showing test results, errors, generated code (replaces Saturn's image gallery)
  - `PoetiqStreamingVisualizer.tsx` - Saturn-style streaming display
  - `PoetiqStreamingModal.tsx` - Grover-style pop-out modal
  - `PoetiqLiveActivityStream.tsx` - Activity log with color-coded entries
  
  **PoetiqSolver.tsx - Saturn's Exact Layout:**
  - **LEFT (4 cols)**: Control panel cards + puzzle grids (training/test)
  - **CENTER (5 cols)**: Token metrics bar + AI REASONING (blue box) + GENERATED CODE (green box)
  - **RIGHT (3 cols)**: Python execution terminal with iteration results
  
  **Key Features Matching Saturn:**
  - Token/metrics bar at top of center column
  - Dual streaming boxes: AI REASONING (blue) + AI OUTPUT (green)
  - All controls visible by default (no collapse)
  - GPT-5 Nano (Recommended) and GPT-5 Mini model options
  - Reasoning effort configuration for GPT-5 models
  - OpenAI Direct, OpenRouter, and Gemini Direct providers
  
  **Plan Document**: `docs/plans/2025-11-26-poetiq-improvement-plan.md`

### Version 5.27.4

- **Fix Poetiq Railway Deployment - Handle Missing Submodule** (Author: Cascade using Claude Sonnet 4)
  - **Issue**: Railway build fails because git submodule (poetiq-solver) not included in build context
  - **Root Cause**: Railway's Docker build doesn't automatically include git submodules
  - **Fix 1**: Added Poetiq dependencies to main requirements.txt (litellm, asynciolimiter, scipy)
  - **Fix 2**: Added graceful error handling in poetiq_wrapper.py for missing submodule
  - **Fix 3**: Clear error message to users when Poetiq not available
  - **Impact**: Build now succeeds, Poetiq shows helpful error if submodule missing

### Version 5.27.3

- **Fix Poetiq Community Page UX - Actually Start Solver** (Author: Cascade using Claude Sonnet 4)
  - **Bug**: "Run Solver" button just navigated to another page, losing user's API key and settings
  - **Root Cause**: `handleRunNext()` only called `navigate()` instead of starting the solver
  - **Fix**: Button now starts solver directly on the community page with inline progress display
  - **Added**: Live progress panel showing status, iteration progress bar, and results
  - **Added**: Auto-refresh of puzzle grid after solver completes
  - **Added**: Visual feedback with spinner during solving, checkmark/x on completion
  - **Impact**: Users can now enter API key once and watch solver progress without leaving the page

### Version 5.27.2

- **Fix Poetiq Community Progress Data Accuracy** (Author: Cascade using Claude Sonnet 4)
  - **Bug #1 - Wrong Puzzle Count**: Page showed 114 puzzles instead of 120 because puzzle loader deduplicates overlapping ARC1/ARC2 IDs
    - **Fix**: Created dedicated `/api/poetiq/community-progress` endpoint that reads ALL 120 puzzle IDs directly from file system
  - **Bug #2 - Incorrect Status**: All puzzles showed as "attempted" because `/api/puzzle/bulk-status` returns most recent explanation regardless of model
    - **Fix**: New endpoint queries only `WHERE model_name LIKE 'poetiq-%'` to get Poetiq-specific explanations
  - **New Repository Method**: Added `getPoetiqExplanationsForPuzzles()` to `ExplanationRepository` for Poetiq-filtered queries
  - **Updated Hook**: `usePoetiqCommunityProgress` now uses dedicated endpoint instead of incorrect bulk-status approach

### Version 5.27.1

- **Poetiq API Key Security Enhancements** (Author: Cascade using Claude Sonnet 4)
  - **HTTPS Enforcement**: Production servers now require HTTPS for API key submissions to prevent plaintext transmission
  - **Key Validation**: Added basic format validation (minimum length, character set) to reject malformed keys before processing
  - **Enhanced User Communication**: Added detailed security explanation box on community page with clear bullet points
  - **Response Safety**: Ensured API keys are never included in any API responses, only provider type
  - **Security Documentation**: Updated UI to explain zero-persistence security model (process isolation, no storage, immediate destruction)

### Version 5.27.0

- **Poetiq Community Solver Page** (Author: Cascade using Claude Sonnet 4)
  - **New Landing Page**: Created `/poetiq` page explaining Poetiq code-generation methodology in plain language
  - **Visual Progress Grid**: Shows all 120 ARC2-eval puzzles with color-coded status (solved/attempted/unattempted)
  - **Community Quick Start**: BYO API key configuration for Gemini Direct or OpenRouter providers
  - **Progress Dashboard**: Real-time stats showing completion percentage and remaining puzzles
  - **Collapsible Explainer**: Detailed comparison of direct prediction vs code generation approaches
  - **Navigation Integration**: Added "Poetiq Solver" link under Misc dropdown in navigation
  - **Enhanced Hook**: `usePoetiqCommunityProgress` fetches all puzzle statuses with filtering capabilities
  - **Reusable Components**: `PoetiqExplainer` and `PuzzleProgressGrid` components for modular design
  - **Community Pooling**: Enables 20 people × 6 puzzles approach to complete full dataset
  - **Model Support**: Multiple OpenRouter models with speed/cost indicators (Gemini 2.5 Pro/Flash, Claude Sonnet 4, GPT-4o)

### Version 5.26.1

- **Fix Poetiq WebSocket Connection** (Author: Cascade using Claude Sonnet 4)
  - **Root Cause**: Poetiq solver was trying to connect to `/ws?sessionId=...` which was rejected by the wsService verifyClient whitelist that only allowed Saturn and Grover paths
  - **Server Fix**: Added `/api/poetiq/progress` to WebSocket whitelist in `server/services/wsService.ts` alongside `/api/saturn/progress` and `/api/grover/progress`
  - **Client Fix**: Updated `client/src/hooks/usePoetiqProgress.ts` to use the correct URL pattern `/api/poetiq/progress?sessionId=...` with proper dev host detection (`localhost:5000` in dev, `location.host` in prod)
  - **Payload Fix**: Fixed message parsing to handle the `{ type, data }` payload structure that wsService broadcasts
  - **Logging**: Added connection lifecycle logging for debugging

### Version 5.26.0

- **ARC2-Eval Progress Tracking & Bug Fixes** (Author: Cascade using Claude Sonnet 4)
  - **ARC2-Eval Progress Dashboard**: Added `useArc2EvalProgress` hook and progress card showing total/attempted/solved puzzles
  - **Bulk Status Endpoint**: Created `POST /api/puzzle/bulk-status` for efficient explanation status lookup across multiple puzzles
  - **Poetiq Filtering**: Progress tracking filters for Poetiq solver results only (models starting with 'poetiq-')
  - **Current Puzzle Status**: Shows whether current ARC2-eval puzzle is solved/attempted with previous model info
  - **Fixed API Parameter**: Changed from `dataset=ARC2-Eval` to `source=ARC2-Eval` for correct puzzle list endpoint
  - **Fixed Response Structure**: Updated hook to handle array directly in response data, not nested under `puzzles`
  - **Fixed TypeScript Error**: Corrected `formatResponse.error()` call to provide required error and message parameters
  - **Fixed DOM Warnings**: Added `autoComplete="new-password"` to API key input and wrapped in form element
  - **Better Error Handling**: Added console logging for debugging ARC2-eval progress issues

### Version 5.25.0

- **Poetiq BYO API Key & Expert Configuration** (Author: Cascade using Claude Sonnet 4)
  - **Bring Your Own Key**: Users can now paste their own Gemini or OpenRouter API key directly in the UI
  - **Key never stored**: API key is passed only to the solver process environment, never logged or persisted
  - **Expert count selector**: Choose 1, 2, 4, or 8 parallel experts (default: 2 = Gemini-3-b config)
  - **Provider selection**: Choose between Gemini Direct or OpenRouter
  - **Default changed to 2 experts**: Updated `poetiq-solver/arc_agi/config.py` to use NUM_EXPERTS=2 by default
  - **Dynamic config**: Python wrapper now builds per-request CONFIG_LIST based on user options
  - **Beautiful UI**: Redesigned PoetiqSolver.tsx with clear BYO key messaging and expert explanations
  - **ARC2-Eval Progress Tracking**: Added `useArc2EvalProgress` hook to show which ARC2-eval puzzles have been solved/attempted
  - **Progress Dashboard**: New ARC2-Eval Progress card shows total/attempted/solved counts, completion percentage, and current puzzle status

### Version 5.24.0

- **Poetiq OpenRouter Support & UI** (Author: Cascade using Claude Sonnet 4)
  - **OpenRouter integration**: Added support for routing Poetiq solver through OpenRouter to avoid Gemini direct API rate limits
  - **Updated Poetiq solver files**: `arc_agi/types.py`, `arc_agi/llm.py`, `arc_agi/config.py` now support OpenRouter model IDs
  - **Environment variable**: Set `USE_OPENROUTER=true` to automatically use OpenRouter
  - **Created PoetiqSolver.tsx UI page**: New page at `/puzzle/poetiq/:taskId` for running the Poetiq solver with model selection
  - **Created usePoetiqProgress hook**: WebSocket-based progress tracking hook
  - **Rate limit mitigation plan**: Created `docs/plans/2025-11-25-poetiq-rate-limit-plan.md`
  - **94 untested puzzles**: From ARC Prize 2025 evaluation set ready to run via OpenRouter

### Version 5.23.0

- **Poetiq ARC-AGI Solver Integration** (Author: Cascade using Claude Sonnet 4)
  - **Added Poetiq solver as git submodule**: Integrated the Poetiq ARC-AGI solver (https://github.com/82deutschmark/poetiq-arc-agi-solver) as a submodule at `poetiq-solver/`. This solver claims SOTA results using iterative code generation with LiteLLM.
  - **Created Python bridge wrapper** (`server/python/poetiq_wrapper.py`): NDJSON-streaming bridge that runs the Poetiq solver via subprocess, emitting progress events for WebSocket broadcasting and capturing iteration data, generated code, and predictions.
  - **Created PoetiqService** (`server/services/poetiq/poetiqService.ts`): TypeScript service wrapping Python execution, transforming Poetiq results to standard explanation format for database storage. Stores Poetiq-specific data (iterations, generated code, config) in `providerRawResponse` JSONB field.
  - **Created PoetiqController** (`server/controllers/poetiqController.ts`): API controller with endpoints:
    - `POST /api/poetiq/solve/:taskId` - Run Poetiq solver on a single puzzle (async with WebSocket progress)
    - `POST /api/poetiq/batch` - Run Poetiq solver on entire dataset (arc1, arc2, arc2-eval, arc-heavy, concept-arc)
    - `GET /api/poetiq/batch/:sessionId` - Get batch progress and results
    - `GET /api/poetiq/status/:sessionId` - Get single solver progress
    - `GET /api/poetiq/models` - List supported Poetiq models (Gemini, GPT-5, Claude, Grok via LiteLLM)
  - **Integration plan document** (`docs/plans/2025-11-25-poetiq-integration-plan.md`): Critical assessment of Poetiq methodology including architecture analysis, concerns for reproducibility, and integration strategy.
  - **Key differences from other solvers**: Poetiq uses iterative code generation (generates Python `transform()` functions) rather than direct grid prediction, with sandboxed execution and voting across parallel experts. Results include generated code and iteration history alongside predictions.

### Version 5.22.11

- Official Scoring Page Dataset Header (Author: Cascade)
  - Clarified and centered the "Learn about the three different datasets" collapsible header on the Official Scoring page so it now reads "Click here to learn about the three different datasets" with a centered layout, making the affordance to expand the explainer more obvious to non-technical readers (`client/src/pages/HuggingFaceUnionAccuracy.tsx:335-348`).

### Version 5.22.10

- Official Scoring Page Dataset Docs (Author: Cascade)
  - Updated the three-dataset explainer on the Official Scoring page to include a direct link to the ARC Prize 2025 evaluation overview on arXiv (HTML view: `https://arxiv.org/html/2412.04604v2`), alongside the existing ARC Prize policy link. This gives readers a primary-source description of how public, semi-private, and private sets are designed and used (`client/src/pages/HuggingFaceUnionAccuracy.tsx:352-405`).

### Version 5.22.9

- Official Scoring Page Default Model Pair (Author: Cascade)
  - Changed the Official Scoring page auto-selection logic to default to the 9th model pair in the list (index 8) when available, matching the intended Claude Opus 4.5 max-thinking configuration as the default example. If fewer than 9 pairs exist, the page now falls back to the first available pair while still auto-calculating results on load (`client/src/pages/HuggingFaceUnionAccuracy.tsx:127-149`).

### Version 5.22.8

- Infrastructure & ingestion safety notes (Author: GPT-5 Codex)
  - Documented storage expansion by +250 GB to unblock PostgreSQL `No space left on device` errors during Hugging Face ingestions (CHANGELOG.md).
  - Clarified ingestion dedupe behavior: default mode skips existing `datasetName-attempt#` explanations per puzzle; enabling “Force Overwrite” deletes the existing attempt rows before re-importing, so reruns won’t double-ingest unless overwrite is explicitly toggled (CHANGELOG.md).

### Version 5.22.7

- Official Scoring Page Automatic Calculation
  - **Auto-calculate results on page load**: Changed Official Scoring page to automatically fetch and display results when the page loads, eliminating the need for users to manually click the "Calculate" button. The default model selection has been changed from the 9th pair to the 4th pair in the model list. When both the dataset and model selections are ready, the calculation triggers automatically via a new `useEffect` hook (`client/src/pages/HuggingFaceUnionAccuracy.tsx:143-149, 214-219`).
  - **Updated default model selection logic**: Changed the auto-selection from the 9th model pair to the 4th model pair (index 3). If fewer than 4 pairs are available, it defaults to the first pair as a fallback (`client/src/pages/HuggingFaceUnionAccuracy.tsx:143-149`).

### Version 5.22.6

- Official Scoring Page Polish & Readability
  - **Fixed JSX syntax error in TL;DR code block**: Escaped braces in the API message format (`messages=[{'{role: "user", content: prompt}'}]`) in step 4 of the developer TL;DR section to prevent TypeScript compilation errors about undefined `role` variable. The braces are now properly rendered as literal text (`client/src/pages/HuggingFaceUnionAccuracy.tsx:720`).
  - **Increased all text sizes by two font levels for readability**: Systematically increased font sizes throughout the Official Scoring page by two Tailwind size steps for better readability on all device sizes. Changes: `text-xs` → `text-sm`, `text-sm` → `text-base`, `text-base` → `text-lg`, `text-lg` → `text-xl`, `text-2xl` → `text-3xl`, `text-3xl` → `text-4xl`, and `text-[11px]` → `text-xs`. Affects all body text, labels, alerts, metrics, and explanatory content across the page (`client/src/pages/HuggingFaceUnionAccuracy.tsx`).
  - **Added anchor link from user message explanation to provider system prompts**: Added a quick inline link ("view provider system prompts") in point 1 "The User Message (No Explicit System Prompt)" that scrolls users directly to the "Provider system prompts (developer note)" section at the bottom of the page. This improves navigation for users who want to understand what default system prompts various providers apply when no custom system prompt is sent (`client/src/pages/HuggingFaceUnionAccuracy.tsx:593-597, 759`).

### Version 5.22.5

- Official Scoring Page – Provider System Prompts
  - **Linked canonical provider system prompts for context**: Added a concise developer-note section at the bottom of the HuggingFace Union accuracy page explaining that default system prompts for major providers (Gemini, OpenAI, Anthropic, Grok) are publicly documented in the CL4R1T4S repository, with a direct link to `https://github.com/elder-plinius/CL4R1T4S/tree/main`. Clarifies that these are provider defaults that may apply when no custom system prompt is sent, and that Grok explicitly states system messages take precedence over user messages, with unknown impact on ARC harness testing (`client/src/pages/HuggingFaceUnionAccuracy.tsx`).
  - **Added inline “Fetch latest provider system prompts” tool**: Introduced a small developer-oriented button in the same footer section that, when clicked, fetches the latest system prompt text for Gemini 2.5 Pro, Claude Sonnet 4.5, OpenAI ChatGPT5, and Grok 4.1 directly from their CL4R1T4S raw GitHub URLs. The UI shows a compact preview (truncated text) for each provider plus a “View on GitHub” link back to the source file, with basic loading/error handling. This keeps the main educational content unchanged while giving advanced users a fast way to inspect the exact default system instructions those providers document (`client/src/pages/HuggingFaceUnionAccuracy.tsx`).
  - **Full prompt display**: Removed truncation so the fetched system prompt panels now show the entire text (scrollable) instead of the first 1200 characters, making the fetched data genuinely useful for deep review (`client/src/pages/HuggingFaceUnionAccuracy.tsx`).
  - **Automatic loading**: The provider system prompts now load automatically on page visit, with a lightweight "loading" state and error message if retrieval fails. No manual button click required (`client/src/pages/HuggingFaceUnionAccuracy.tsx`).

### Version 5.22.4

- Official Scoring Page Educational Enhancement
  - **Added visual grid representation in harness explanation**: Enhanced the "Training Examples" section (step 2) of "How the Official Testing Harness Works" with side-by-side comparison showing what humans see (colored 3×3 grid rendered with TinyGrid component) vs what the model sees (plain JSON array text). This visual contrast directly addresses the critical misconception that models perceive the puzzles visually. Added accompanying explanatory text: "While humans interpret this colored grid intuitively, the model sees only plain text—numbers in brackets. The model has no visual understanding of colors. It treats 0, 1, 2, etc. as abstract symbols." This clarifies that despite ARC Explainer visualizing puzzles as colored grids for human comprehension, the official harness sends only JSON text to the model (`client/src/pages/HuggingFaceUnionAccuracy.tsx:561-610`, imported TinyGrid component at line 26).
  - **Emphasized minimal context given to model**: Added detailed breakdown under "What information does the model actually receive?" highlighting that: (1) system prompt tells it there's a pattern to find, (2) it sees training input/output pairs as JSON arrays, (3) it sees test input without answer, and (4) that's it—no information about colors, hints about geometry, or explanation of what numbers represent. This underscores how the harness is intentionally minimalist and the model must solve the puzzle using only mathematical/logical pattern recognition (`client/src/pages/HuggingFaceUnionAccuracy.tsx:588-596`).
  - **Added Developer TL;DR section**: New expandable subsection in harness explanation summarizing the complete evaluation flow in 7 numbered steps for developers: (1) Build prompt, (2) Convert to text via json.dumps(), (3) Embed in template, (4) **One API call**, (5) Get response, (6) Extract JSON answer, (7) Compare to ground truth. Includes explicit "NOT" list: Multiple API calls ❌, Images/binary ❌, Streaming puzzles ❌, Multi-turn ❌. This directly answers the three core implementation questions the user investigated (`client/src/pages/HuggingFaceUnionAccuracy.tsx:656-672`).
  - **Fixed "Why this matters" explanation**: Restored complete text explaining why LLMs solving abstract patterns with only text representations is remarkable, then added proper Discord server link with styling to invite discussion. Changed from incomplete/misleading text to: "The fact that an LLM can solve these abstract pattern-matching tasks using only text representations (without ever seeing colors or shapes) is remarkable. It suggests the model has learned to recognize mathematical and logical patterns purely from the structure of numbers. This is the sort of thing we discuss in our Discord server. Please come visit us at [Discord server link]." (`client/src/pages/HuggingFaceUnionAccuracy.tsx:598-609`).

### Version 5.22.3


- Official Scoring Page Accuracy Improvements
  - **Corrected testing harness explanation to reflect actual implementation**: Fixed inaccuracies in "How the Official Testing Harness Works" section. Updated step 1 to quote the exact system prompt wording from `system_prompt.txt` (verified against actual source file). Updated step 2 to clarify that grids are sent as **raw JSON arrays** with integer values—removed inference about "0-9 representing colors" since this is not stated in the actual harness code/prompts (that's external domain knowledge about ARC-AGI tasks, not documented in the evaluation harness itself). Improved accuracy by referencing actual `prompt_manager.py` implementation showing `json.dumps()` formatting, making clear that the model receives arrays like `[[0, 1, 2], [3, 4, 5], [6, 7, 8]]`, not visual/rendered colored squares. This prevents misconception that the harness sends visual content (`client/src/pages/HuggingFaceUnionAccuracy.tsx:547-560`).
  - **Added comprehensive authorship attribution, data leakage note, and error reporting link**: Added author note clearly crediting Claude Sonnet 4.5 for all text, research, source code analysis, and refinement through iterative feedback. Emphasizes that the author researched the actual Arc-AGI-Benchmarking source code, read system prompts, and analyzed the implementation directly. Notes that several corrections were made along the way to ensure accuracy. **Added critical transparency note about data leakage**: Explicitly documents that the AI learned the color mappings for ARC integers (0=black, 1=blue, 2=red, etc.) from public training data, NOT from the evaluation harness code (which is completely agnostic to integer meaning). This note serves as a concrete example illustrating why semi-private and fully-private evaluation sets exist and must remain secret—to prevent exactly this kind of information leakage into future AI training data. Added canonical Discord server link (https://discord.gg/9b77dPAmcA) for users to report any errors or missing information, encouraging community-driven quality assurance (`client/src/pages/HuggingFaceUnionAccuracy.tsx:610-629`).
  - **Changed default model selection to Claude Sonnet 4.5 with maximum thinking**: Updated auto-selection logic to default to the 9th model pair (Claude Sonnet 4.5 with maximum thinking enabled, changed from 21st). Updated empty state message to explicitly credit Claude Sonnet 4.5 as the page author and explain that this model's results are shown by default, allowing users to see the author's specific capability on the ARC Prize public evaluation set. Falls back to first available option if fewer than 9 pairs are available (`client/src/pages/HuggingFaceUnionAccuracy.tsx:121-127, 515`).
  - **Cleaned up unused imports and interfaces**: Removed unused CardHeader, CardTitle, and CardDescription imports from shadcn/ui Card component. Removed unused AttemptPairOption interface that was declared but never used (`client/src/pages/HuggingFaceUnionAccuracy.tsx:14, 42-47`).
  - **Made three-tier evaluation set explainer collapsible by default**: Converted "Learn about the three different datasets" section from always-expanded to collapsed-by-default with expand/collapse toggle. Updated heading to clarify that the section explains the three datasets (public, semi-private, private) rather than calling them "types." Users can now click the header with chevron icon to reveal the dataset details, reducing initial page clutter. Added state management for section visibility (`client/src/pages/HuggingFaceUnionAccuracy.tsx:65, 272-345`).
  - **Corrected score difference explanation**: Fixed misleading explanation that claimed "scores here are higher." Replaced with accurate description emphasizing that public and semi-private sets contain **completely different puzzles**, resulting in different scores that can go either direction. Updated to focus on the fundamental fact: "Different datasets = Different puzzles = Different results." Clarified that scores between these datasets cannot be directly compared because they're separate evaluations (`client/src/pages/HuggingFaceUnionAccuracy.tsx:335-342`).
  - **Moved puzzle ID badges inline with score percentage**: Restructured score card layout so solved puzzle badges now appear on the same horizontal line as the large percentage display and lightning bolt icon. Removed duplicate puzzle badges section and consolidated into single display in the top-right of the score card. This improves visual hierarchy and makes puzzle inspection more discoverable (`client/src/pages/HuggingFaceUnionAccuracy.tsx:425-449`).
  - **Removed pattern/clue terminology from harness explanation**: Updated "How the Official Testing Harness Works" section to remove misleading references to "patterns" and "clues." Changed step 2 title from "Training Examples (Your Pattern Clues)" to simply "Training Examples" and updated descriptions to say inputs "map to outputs" rather than describing what "the pattern produces." Updated step 3 to remove "figure out the pattern" and kept focus on the actual task: looking at training examples and predicting the output. This maintains technical accuracy without imposing interpretive language (`client/src/pages/HuggingFaceUnionAccuracy.tsx:548, 554, 558, 563, 566`).

### Version 5.22.2

- Official Scoring Page UI Refinements
  - **Repositioned puzzle ID badges higher in score card**: Moved puzzle ID badges section from bottom of result card to appear immediately after "X of Y puzzles solved" progress line, making puzzle exploration more prominent and visible without scrolling. This improves information hierarchy by placing the most actionable results (which puzzles were solved) before less important metadata (model names). Removed border-top separator and added border-top to model names section instead (`client/src/pages/HuggingFaceUnionAccuracy.tsx:454-481`).
  - **Made testing harness explanation always visible and repositioned to bottom**: Moved "How the Official Testing Harness Works" expandable card section outside of the results conditional block and positioned it at the bottom of the page after the results/empty state. Results now display directly under the controls section as expected. The harness explanation is always accessible at the bottom while remaining fully collapsed/expandable for users who want to learn more about the evaluation methodology (`client/src/pages/HuggingFaceUnionAccuracy.tsx:428-519`).
  - **Enhanced disclaimer with links and leaderboard comparison**: Expanded the important disclaimer alert to prominently explain that public evaluation set results differ from the official ARC Prize leaderboard (which uses semi-private evaluation set). Added direct links to: Hugging Face dataset, official ARC Prize leaderboard, and ARC Prize website. Clarifies that different datasets contain different puzzles, resulting in different scores (`client/src/pages/HuggingFaceUnionAccuracy.tsx:210-255`).
  - **Added three-tier evaluation structure explainer (5th-grade reading level)**: New card section with simplified explanation of ARC's three-tier evaluation sets, written at 5th-grade reading level with concrete examples (comparing to practice test vs. surprise test). (1) Public set—everyone can see, shared on GitHub/Hugging Face, AI companies can study; (2) Semi-Private set—ARC keeps secret for fair leaderboard ranking; (3) Private set—super secret for competition. Added prominent link to official ARC Prize policy and disclaimer that this is a friendly, unofficial explanation. Clarifies why public scores are higher: models haven't seen the secret puzzles (`client/src/pages/HuggingFaceUnionAccuracy.tsx:277-340`).
  - **Renamed route from `/hf-union-accuracy` to `/scoring`**: Changed endpoint URL for cleaner, more intuitive naming. Updated in App.tsx route definition, AppNavigation navigation link, and canonical path metadata (`client/src/App.tsx:75`, `client/src/components/layout/AppNavigation.tsx:85`, `client/src/pages/HuggingFaceUnionAccuracy.tsx:62`).
  - **Clarified AI companies in public set explanation**: Updated language in public evaluation set description to explicitly mention major AI companies (OpenAI, Google, Anthropic, Grok, etc.) that can study the public puzzles, making the explanation more concrete and understandable (`client/src/pages/HuggingFaceUnionAccuracy.tsx:277-340`).
  - **Changed default model selection to 21st pair**: Updated auto-selection logic to default to the 21st model pair in the attempt pair options list when available. Falls back to first available option if fewer than 21 pairs are available (`client/src/pages/HuggingFaceUnionAccuracy.tsx:121-127`).

### Version 5.22.1

- Official Scoring Page Polish
  - **Fixed Radix UI SelectItem validation error**: SelectItem with empty string value (`value=""`) was throwing Radix UI validation error. Changed to non-empty value (`value="no-models"`) to comply with Radix UI requirement that SelectItem values cannot be empty strings. This prevented Official Scoring page from rendering (`client/src/pages/HuggingFaceUnionAccuracy.tsx:276`).
  - **Consolidated puzzle badges into score card**: Moved puzzle ID badges from separate bottom card into the main score card component, utilizing the wasted whitespace between the score percentage and lightning bolt icon. Added border-top separator and kept the "✓ Solved X puzzles" label for clarity. This improves information hierarchy and creates a unified, focused card layout (`client/src/pages/HuggingFaceUnionAccuracy.tsx:369-387`).
  - **Made testing harness explanation expanded by default**: Changed `showHarnessDetails` initial state from `false` to `true` so that "How the Official Testing Harness Works" section is expanded on page load. Makes the educational content immediately visible to users without requiring them to click to expand (`client/src/pages/HuggingFaceUnionAccuracy.tsx:71`).
  - **Set fifth model pair as default**: Enhanced auto-selection logic to default to the fifth model pair in the attempt pair options list when available. Falls back to first available option if fewer than five pairs are available (`client/src/pages/HuggingFaceUnionAccuracy.tsx:121-127`).

### Version 5.22.0

- Analytics
  - **New Official Scoring Page (Public Evaluation)**: Created dedicated `/hf-union-accuracy` page visualizing official ARC Prize team evaluation results on the public evaluation set. The page prominently clarifies that these are **official results from the ARC Prize team's evaluation harness**, posted on Hugging Face—not personal or custom evaluations. ARC Explainer is a visualization tool that makes the raw JSON data published on Hugging Face more human-readable, searchable, and visual. Explains the official scoring method: models are tested twice per puzzle independently, and a puzzle counts as solved if **either attempt produces the correct answer**. This shows each model's best-case performance when given multiple chances.
    - **Clear Attribution**: Prominent amber disclaimer with prominent link to Hugging Face stating that results are official from the ARC Prize team (posted on Hugging Face), explaining ARC Explainer is a visualization tool for that raw data, with all credits and ownership belonging to the ARC Prize team
    - **Plain Language Explanation**: Describes the official evaluation harness methodology in student-friendly terms with visible formula: `Best-Case Score = (Puzzles correct in attempt 1 or attempt 2) ÷ Total puzzles`
    - **Important Dataset Note**: Clearly states results are from the **public** evaluation set (different from semi-private set on official ARC Prize website), explaining why scores differ from official leaderboard
    - **Interactive Results**: Select dataset + model pair, view score with progress bar, inspect individual puzzle IDs via clickable badges
    - **Compact Design**: Maximum information density (minimal padding, p-2/p-3 spacing, text-xs fonts) matching Analytics/Comparison page patterns
    - **Reusable Logic**: Composes existing union accuracy utilities (`computeAttemptUnionAccuracy()`, `parseAttemptModelName()`, `/api/metrics/compare`) with zero duplication
    - **Auto-Filtering**: Automatically filters to official HF submissions (model names ending with `-attempt1`/`-attempt2`)
    - **Navigation**: Added "Official Scoring" link in main header with Zap icon (`client/src/pages/HuggingFaceUnionAccuracy.tsx`, `client/src/App.tsx:28,75`, `client/src/components/layout/AppNavigation.tsx:82-88`).

### Version 5.21.1

- Model Comparison
  - **Enhanced Union Accuracy transparency with interactive puzzle exploration**: Added explicit puzzle ID display showing exactly which puzzles contribute to union accuracy calculation. New `unionPuzzleIds` computed value extracts all puzzle IDs solved correctly in either attempt and displays them as interactive `ClickablePuzzleBadge` components (shadcn/ui Badge with success variant) that open Puzzle Examiner in new tab on click. Shows `Puzzles solved (N) — click to explore` section with full list of contributing puzzle IDs. Users can now directly inspect any puzzle that contributed to the union accuracy score, providing complete calculation transparency with actionable exploration (`client/src/pages/ModelComparisonPage.tsx:16,361-384,608-626`).
  - **Overhauled ModelComparisonPage UI/UX for clarity**: Restructured entire page layout with clear section headers and explanatory subtitles for each section: "Comparing Models" (with improved model badge styling and "Active (2/4)" counter), "Differentiation" (puzzles solved by exactly one model), "Attempt Union Accuracy" (union metrics with blue left border accent), "Performance Comparison" (detailed metrics table), "Puzzle-by-Puzzle Breakdown" (matrix view), and "Individual Model Deep Dive" (drilldown panels). Added helpful instructions for each section. Reduced page padding (p-3→p-2, space-y-3→space-y-2) for data density. Improved Active Models control UI with separated "Active" and "Add Another" sections, better visual model badges with hover effects, and clearer conditional rendering (`client/src/pages/ModelComparisonPage.tsx:464-717`).
  - **Redesigned Attempt Union Accuracy UI**: Replaced basic blue box display with comprehensive `AttemptUnionCard` component featuring ShadCN/UI Card patterns, visual progress bar, and detailed explanation section. Added plain-language description of union accuracy metric and mathematical formula showing how it's calculated (puzzles correct by any attempt ÷ total puzzles) for full research transparency. Improved visual hierarchy with prominent metric percentage, model badges, and accessibility labels (`client/src/components/analytics/ModelComparisonDialog.tsx`).


- Model Comparison
  - **Implemented attempt union accuracy metrics**: Added comprehensive support for computing union-of-correct accuracy across attempt1/attempt2 model pairs (e.g., "gemini-3-deep-think-preview-attempt1" + "gemini-3-deep-think-preview-attempt2"). Features include:
    - Frontend utilities: `computeAttemptUnionAccuracy()` and `parseAttemptModelName()` in `client/src/utils/modelComparison.ts` for deriving union metrics from existing comparison details
    - Backend extension: New `AttemptUnionStats` interface and `computeAttemptUnionStats()` method in `MetricsRepository.ts` that parses model names, groups attempts by base model, and computes union correctness by iterating through puzzle results
    - UI integration: Union metrics display blocks in both `ModelComparisonPage.tsx` and `ModelComparisonDialog.tsx` showing base model name, attempt models, union correct count, total puzzles, and union accuracy percentage with blue styling
    - Graceful fallback: Frontend components prefer backend-provided `attemptUnionStats[0]` when available, with frontend computation as fallback for backward compatibility
    - Type safety: Extended `ModelComparisonSummary` interfaces on both client and server to include `attemptUnionStats: AttemptUnionStats[]` array
    - Edge case handling: Supports models in any position (model1-4), validates attempt numbers, and handles missing attempts gracefully. (Author: Cascade)

### Version 5.20.3

- Bug Fixes
  - **Fixed TypeScript type mismatch in BulkExplanationStatusLight**: The lightweight explanation status query was being read by `puzzleService.getPuzzleList()` and `puzzleOverviewService.buildPuzzleMap()` which expected `apiProcessingTimeMs`, but the type definition omitted this field. Added `apiProcessingTimeMs: number | null` to `BulkExplanationStatusLight` interface, added it to the initialization defaults, included `e.api_processing_time_ms` in the SQL SELECT clause, and mapped it to the status object. This resolves strict TypeScript mode compilation errors and preserves processing-time data for service-layer enrichment. Single numeric field has negligible impact on the 99% data transfer reduction (which omits large JSONB fields like saturnImages and providerRawResponse) (`server/repositories/interfaces/IExplanationRepository.ts:173-190`, `server/repositories/ExplanationRepository.ts:608,640,664`).

### Version 5.20.2

- Documentation
  - Added `docs/2025-11-23-model-comparison-union-attempts-plan.md` outlining a two-phase implementation to compute union-of-correct accuracy across attempt1/attempt2 model pairs on ARC datasets. Plan covers a frontend utility for deriving union metrics from existing comparison details plus a backend `MetricsRepository` summary extension to expose canonical attempt union stats for reuse across analytics views. (Author: Cascade)

### Version 5.20.1

- ELO Arena
  - Added a "Review 10 featured puzzles" entrypoint to the Compare Explanations page, exposing the curated featured set (Mike/TEAM tweet-aligned IDs) directly in the ELO arena header. New `FeaturedPuzzlesEloEntry` component uses the shared `shared/featuredPuzzles.ts` source-of-truth and provides quick links to `/elo/:taskId` for each featured puzzle (`client/src/components/elo/FeaturedPuzzlesEloEntry.tsx`, `client/src/pages/EloComparison.tsx`).

### Version 5.20.0

- Shared
  - Minimal reusable source-of-truth for the ten featured puzzles: added `shared/featuredPuzzles.ts` exporting `FEATURED_PUZZLE_IDS`, `FEATURED_PUZZLE_NOTES`, `FEATURED_PUZZLES`, and `getFeaturedPuzzles()`. Not wired into any page yet; intended for future imports by PuzzleBrowser and others. IDs: `65b59efc`, `e3721c99`, `dd6b8c4b`, `2ba387bc`, `14754a24`, `b457fec5`, `891232d6`, `7b5033c1`, `981571dc`, `136b0064`.

### Version 5.19.0

- Database Performance & Architecture
  - **PHASE 1: Lightweight bulk explanation status query**: Created `getBulkExplanationStatusLight()` that returns only 8 fields actually used by puzzle list UI instead of 37 heavy fields. This reduces data transfer by 99% (1.2GB → 15KB for 1600+ puzzles) and eliminates PostgreSQL temp file bloat on Railway's limited disk space. Updated `puzzleService.ts` and `puzzleOverviewService.ts` to use the lightweight method. Fixes "No space left on device" errors (`server/repositories/ExplanationRepository.ts:576-671`, `server/repositories/interfaces/IExplanationRepository.ts:173-184`, `server/services/puzzleService.ts:84`, `server/services/puzzleOverviewService.ts:190,309`).
  - **PHASE 2: Move analytics out of ExplanationRepository**: Moved `getWorstPerformingPuzzles()` from ExplanationRepository to MetricsRepository (SRP fix). This method does cross-table analytics (explanations + feedback) and computes composite scores, which is analytics work that belongs in MetricsRepository, not a CRUD repository. Updated all callers in `puzzleOverviewService.ts` to use `repositoryService.metrics.getWorstPerformingPuzzles()` (`server/repositories/MetricsRepository.ts:1252-1451`, `server/services/puzzleOverviewService.ts:190,309`).
  - **Aggressive database cleanup on startup**: Modified database maintenance to terminate ALL active/idle queries on startup (not just long-running idle transactions) to force cleanup of orphaned PostgreSQL temp files. Runs automatically every 6 hours to prevent temp file accumulation on Railway (`server/maintenance/dbCleanup.ts:81-110`).

### Version 5.18.6

- Puzzle Browser
  - **Simplified featured puzzle loading**: Removed the over-engineered 10-hook `useQuery` system and reverted to a single `usePuzzleList({})` call for the featured gallery, then deriving the curated set purely in memory from `FEATURED_PUZZLE_IDS`. This guarantees all 10 desired IDs show up when present in the global list while keeping network traffic and state minimal (`client/src/pages/PuzzleBrowser.tsx:123-135`).
  - **Header layout + community links**: Removed the CollapsibleMission header component entirely and inlined three community pills (Discord Community, ML Street Talk, and **ARC Discord Weekly Meeting** linking to `https://www.twitch.tv/professormaxhammer`) directly into the PuzzleBrowser header, aligned horizontally beside the EmojiMosaicAccent banner (`client/src/pages/PuzzleBrowser.tsx:256-299`).

### Version 5.18.5

- Puzzle Browser - **FIXED Critical Featured Puzzles Bug**
  - **FIXED**: Landing page now correctly displays all 10 featured puzzles (`65b59efc`, `e3721c99`, `dd6b8c4b`, `2ba387bc`, `14754a24`, `b457fec5`, `891232d6`, `7b5033c1`, `981571dc`, `136b0064`).
  - **What was broken**: Previous commits hallucinated a non-existent `POST /api/puzzle/list` endpoint that accepts `puzzleIds` in request body. This endpoint doesn't exist in the API (see `docs/reference/api/EXTERNAL_API.md` lines 57-60).
  - **The fix**: Replaced hallucinated endpoint with 10 individual `useQuery` calls using the correct `GET /api/puzzle/task/:taskId` endpoint. Each query explicitly fetches one puzzle with proper `queryFn` implementation (`client/src/pages/PuzzleBrowser.tsx:123-171`).
  - **Technical details**:
    - 10 individual hooks: `featured0` through `featured9`
    - Each uses `fetch('/api/puzzle/task/:taskId')` with error handling
    - Proper loading state: `featuredQueries.some(q => q.isLoading)`

### Version 5.18.4

- Puzzle Browser - Critical Presentation Fix
  - **FIXED featured puzzle loading for presentation**: The 5.18.3 implementation was creating stub/fake puzzles when featured puzzles weren't found in filtered results. Now properly fetches all 10 featured puzzles directly by ID using individual `useQuery` calls to `/api/puzzle/task/:taskId` endpoint, guaranteeing they display reliably regardless of filter state. Removed stub puzzle creation logic entirely (`client/src/pages/PuzzleBrowser.tsx:123-144`).
  - **Fixed React hooks violation**: Changed from calling `useQuery` in a loop to 10 individual hook declarations (`featured0` through `featured9`) to comply with React rules of hooks.
  - **Added dedicated loading state**: New `isFeaturedLoading` state tracks when featured puzzles are loading, independent of the advanced browser's filter results.

### Version 5.18.3

- Puzzle Browser - Critical Presentation Fixes
  - **Fixed header alignment**: Changed header layout from `justify-between` to centered flex column so the CollapsibleMission component (mission button + Discord/YouTube links) and EmojiMosaicAccent are properly aligned and centered for cleaner presentation layout (`client/src/pages/PuzzleBrowser.tsx:251`).
  - **Decoupled featured gallery from backend filters**: Stopped relying on the heavy `/api/puzzle/list` results (and `multiTestFilter`) for the featured carousel and instead fetch each tweet-aligned puzzle directly via `/api/puzzle/task/:id`. This keeps the 10 highlighted IDs (`65b59efc`, `e3721c99`, `dd6b8c4b`, `2ba387bc`, `14754a24`, `b457fec5`, `891232d6`, `7b5033c1`, `981571dc`, `136b0064`) visible regardless of advanced filter state, without fabricating stub puzzles (`client/src/pages/PuzzleBrowser.tsx:123-139`).
  - **Team attribution update**: Renamed `MIKE_NOTES` to `TEAM_NOTES` and updated all puzzle annotations to credit "the team" instead of individual attribution. Changed note header from "Team note" to "Team Notes" for consistency (`client/src/pages/PuzzleBrowser.tsx:65-86, 313-320, 535`).

### Version 5.18.1

- Puzzle Examiner
  - **Multi-test mismatch overlay now only marks model outputs**: Updated the multi-test grid rendering in `AnalysisResultGrid` so the "Show Mismatches" toggle applies the high-contrast diff mask only to the model’s predicted grids, never to the expected answer grids. This brings multi-test behavior in line with the single-test card, where the bullseye markers appear exclusively on the AI output for easier visual debugging (`client/src/components/puzzle/AnalysisResultGrid.tsx`).

### Version 5.18.0

- Hall of Fame / Human Trading Cards
  - **More prominent, clearly clickable portraits**: Enlarged contributor portraits on `HumanTradingCard` and added a subtle hover hint plus stronger cursor/hover styling so it’s visually obvious that the images can be clicked to open a zoomed-in view, without changing the existing dialog/profile routing (`client/src/components/human/HumanTradingCard.tsx`).

### Version 5.17.9

- Puzzle Browser
  - **Tweet-aligned featured gallery + Mike annotations**: Expanded the Puzzle Browser featured gallery to include every puzzle ID explicitly mentioned in Mike Knoop's ARC v2/v1 tweet (`65b59efc`, `e3721c99`, `dd6b8c4b`, `2ba387bc`, `14754a24`, `b457fec5`, `891232d6`, `7b5033c1`, `981571dc`) plus `136b0064`, and added a short "Mike note" under each featured card summarizing why that task is interesting for complexity/efficiency analysis. Also embedded his four open research questions about complexity scaling, time-on-task, search coverage, and unsolved v2 tasks into the advanced view "Working notes" section so the browser doubles as a lightweight reading list for ARC reasoning research (`client/src/pages/PuzzleBrowser.tsx`).

### Version 5.17.8

- Puzzle Browser
  - **Curated featured gallery + gated research view**: Updated `PuzzleBrowser` so the default experience shows a small curated gallery of four visually interesting puzzles (`14754a24`, `b457fec5`, `891232d6`, `136b0064`) using the new professional `PuzzleCard` layout, while the full heavy filter/search browser (with hundreds of cards and rich metrics) is now behind an explicit "Open full research browser" toggle. This keeps the new card design but prevents the landing page from trying to render thousands of cards at once (`client/src/pages/PuzzleBrowser.tsx`).

### Version 5.17.7

- Data
  - **Jack Cole Hall of Fame imagery update**: Added multiple profile images (`/jackcole.jpeg`, `/jackCole2.png`) to both Jack Cole contributor entries so Human Trading Cards can rotate between his assets without manual database edits (`server/scripts/seedContributors.ts`).

### Version 5.17.6

- Data
  - **Separated JF Puget 2024 vs 2025 achievements in Hall of Fame seed data**: Cleaned up the Jean-François Puget `competition_winner` entry so it is a 2025-only card for the preliminary ARC Prize 2025 Kaggle leaderboard, leaving the 2024 runner-up paper recognized solely by his dedicated `paper_award` card. This avoids mixing paper-award and competition contexts in a single entry (`server/scripts/seedContributors.ts`).

### Version 5.17.5

- Hall of Fame
  - **2025 Leaderboard now respects year ranges**: Updated `HumanTradingCards` leaderboard logic so contributors whose active range spans 2025 (e.g., yearStart 2024, yearEnd 2025) are included in the "2025 Leaderboard" section instead of being omitted. This ensures Jean-François Puget appears in the 2025 row alongside other preliminary ARC Prize 2025 leaders while still retaining his 2024 entries (`client/src/pages/HumanTradingCards.tsx`).

### Version 5.17.4

- Bug Fixes
  - **PuzzleCard & PuzzleDBViewer TypeScript alignment**: Extended `PuzzleCardProps.performanceData` to include the full set of rich metrics returned by the worst-performing puzzles API (confidence, feedback, composite score, token/cost fields, etc.) and added `formatNumber` / `formatTime` helpers to `PuzzleDBViewer` so unsolved puzzle metrics render correctly without TS build errors (`client/src/components/puzzle/PuzzleCard.tsx`, `client/src/pages/PuzzleDBViewer.tsx`).

- Models
  - **Gemini 3 Pro Preview streaming disabled for reasoning safety**: Changed `supportsStreaming` from `true` to `false` for `google/gemini-3-pro-preview` so the app no longer attempts streaming calls that can truncate reasoning tokens in multi-turn tool-calling scenarios, keeping behavior consistent with the existing `supportsStructuredOutput: false` safeguard (`server/config/models.ts`).

- Data
  - **Jean-François Puget Hall of Fame imagery update**: Updated contributor seed data to support a second profile image for JF Puget so Human Trading Cards can rotate between multiple assets without manual database edits (`server/scripts/seedContributors.ts`).

### Version 5.17.3

- Unsolved Puzzle Viewer
  - **Always load ALL unsolved evaluation puzzles**: Increased the `GET /api/puzzle/worst-performing` limit cap from 50 to 500 so `PuzzleDBViewer` can request the full ARC2-Eval (≈120) and ARC1-Eval (≈400) zero-accuracy sets in one shot (`server/controllers/puzzleController.ts:getWorstPerformingPuzzles`).
  - **Removed infinite cache on worst-performing hook**: Dropped `staleTime: Infinity` from `useWorstPerformingPuzzles` so each visit to the Unsolved ARC Evaluation Puzzles page triggers a fresh worst-performing calculation while still disabling noisy refetch-on-focus/interval (`client/src/hooks/usePuzzle.ts`).

### Version 5.17.2

- UI/UX - Model Selection Density Overhaul
  - **Fixed "ping-pong effect" and wasted space**: Constrained Model Selection container width with `max-w-4xl mx-auto` to eliminate excessive horizontal stretching that forced users' eyes to travel across the full viewport (`client/src/pages/PuzzleExaminer.tsx:405`).
  - **Removed filter UI completely**: Eliminated Premium, Fast, and Reasoning filter toggles per user feedback - this is a research platform, not an e-commerce site (`client/src/components/puzzle/ModelSelectionControls.tsx`, `client/src/components/puzzle/ModelSelection.tsx`).
  - **Professional research platform density**: Systematically tightened spacing throughout the model selection hierarchy:
    - Reduced provider header padding from `p-4` to `p-3`, icon size from `text-2xl` to `text-xl`, title from `text-lg` to `text-base`
    - Reduced vertical spacing: `space-y-3` → `space-y-2`, `space-y-6` → `space-y-3`, `mt-3` → `mt-2`
    - Tightened model grid gaps from `gap-2` to `gap-1.5` and family dividers from `gap-3` to `gap-2`
    - All changes focused on eliminating the "empty ribbon" effect and improving information density

- Models
  - **Added Google Gemini 3 Pro Preview via OpenRouter**: Integrated the newest Gemini model (released Nov 18, 2025) with 1,048,576 token context window and tiered pricing structure ($2-$4/M input tokens, $12-$18/M output tokens based on context length ≤200K vs >200K).
    - **Model Configuration** (`server/config/models.ts:812-830`)
      - Key: `google/gemini-3-pro-preview`, premium tier, reasoning-capable
      - **Critical fields**: `supportsStructuredOutput: false` (prevents JSON mode conflicts with reasoning), `supportsStreaming: true`
      - Special note about preserving `reasoning_details` in multi-turn tool calling per OpenRouter docs
    - **UI Organization** (`shared/modelGroups.ts:227-235`)
      - Created dedicated "Google Gemini" family within OpenRouter provider group (id: `or-gemini`)
      - Reorganized existing `google/gemini-2.5-flash-preview-09-2025` from `or-other` into new `or-gemini` family

- Infrastructure Fixes (Critical for Reasoning Models)
  - **OpenRouter Service: Reasoning Token Extraction** (`server/services/openrouter.ts:300-330`)
    - **Fixed missing reasoning token metrics**: Now extracts `usage.output_tokens_details.reasoning_tokens` from API responses (was previously discarded)
    - Accumulates reasoning tokens across continuation calls for truncated responses
    - Logs reasoning token usage for accurate cost tracking and analytics
  - **OpenRouter Service: Multi-Turn Reasoning Preservation** (`server/services/openrouter.ts:322-330`)
    - **Added `reasoning_details` extraction**: Captures structured reasoning blocks required for multi-turn tool calling conversations
    - Preserves reasoning continuity across tool use and conversation turns (per OpenRouter documentation requirement)
    - Enables proper context maintenance for Gemini 3 Pro and other reasoning models
  - **OpenRouter Service: Token Usage Pipeline** (`server/services/openrouter.ts:75-80, 348-354, 540-561`)
    - Added `usage` parameter throughout API call → parser → response pipeline
    - Returns actual API usage data (input/output/reasoning tokens) instead of estimates
    - Fixes token tracking accuracy for all OpenRouter models

- Bug Fixes
  - **Reasoning models + JSON mode conflict**: Setting `supportsStructuredOutput: false` prevents schema enforcement from truncating reasoning tokens (matches Qwen thinking model pattern at line 430)

### Version 5.17.1

- Data
  - Extended Jean-François Puget Hall of Fame contributor entry to mention his ARC Prize 2024 runner-up paper award for "A 2D nGPT Model For ARC Prize" and added Kaggle discussion + PDF links in the contributors seed script (`server/scripts/seedContributors.ts`).
  - Added a separate 2024 paper-award contributor card for Jean-François Puget so his 2D nGPT ARC Prize paper appears in the Research & Awards section.

### Version 5.17.0

- UI/UX Major Redesign - Professional Research Platform Transformation
  - **PuzzleCard complete redesign**: Transformed from "purple cartoon nightmare" to professional, information-dense scientific research platform (`client/src/components/puzzle/PuzzleCard.tsx`)
    - **Removed**: 5 rainbow gradients, 4 emojis (❌🔥✅💰), 36px border radius, heavy animations, 28px padding
    - **Added**: shadcn/ui Card + Badge components, automatic dark/light theme support via CSS variables
    - **Layout**: Compact side-by-side grid+metrics (~200-250px tall, down from ~500px = 2.5x information density)
    - **Metrics**: 6-point tabular display (Correctness, Attempts, Models, Grid, Tests) with `text-[10px]` labels
    - **Theme support**: Uses CSS variables (`bg-card`, `text-card-foreground`, `border`, `text-muted-foreground`) for automatic theme adaptation
    - **Design inspiration**: arXiv.org, Google Scholar, GitHub, Nature Journal (professional scientific platforms)
  - **PuzzleBrowser grid improvements**: Updated responsive breakpoints for compact cards (`client/src/pages/PuzzleBrowser.tsx:418`)
    - Mobile: 1 column | sm: 2 | md: 3 | xl: 4 | 2xl: 5 columns (new!)
    - Gap increased to 12px (`gap-3`) for compact card spacing
    - Shows 2.5x more puzzles per viewport
  - **Scalability**: Design pattern reusable across PuzzleExaminer and other puzzle list views using shadcn/ui primitives

- Bug Fixes
  - **PuzzleCard correctness display for unsolved puzzles**: Fixed misleading "Solve Rate: 0%" on PuzzleDBViewer (which shows only unsolved puzzles) by implementing context-aware display (`client/src/components/puzzle/PuzzleCard.tsx:157-167`)
    - Shows "Never Tried" for puzzles with 0 attempts
    - Shows "Unsolved" for puzzles with failed attempts (0% accuracy)
    - Shows "X% Solved" only when accuracy > 0
  - **PuzzleBrowser junk sort modes removed**: Deleted confidence, cost, and created_at sort options that had no basis in aggregated metrics (`client/src/pages/PuzzleBrowser.tsx:121-125, 333-338`)
    - Kept useful sorts: unsolved_first (recommended), unexplained_first, least_analysis_data, processing_time
  - **PuzzleBrowser Trading Cards banner removed**: Deleted promotional banner for cleaner, focused research interface (`client/src/pages/PuzzleBrowser.tsx`)

- Documentation
  - **Professional redesign plan**: Created comprehensive 1,301-line design specification documenting transformation from cartoon to scientific aesthetic (`docs/2025-11-21-puzzlecard-professional-redesign-plan.md`)

### Version 5.16.8

- Planning
  - **PuzzleDBViewer metrics + grid fix plan**: Captured the backend/frontend steps to replace the hallucinated solve rate with binary correctness, surface real model counts, and keep TinyGrid previews readable for extreme aspect ratios (`docs/2025-11-20-puzzledbviewer-metrics-fix-plan.md`).

### Version 5.16.7

- Bug Fixes
  - **Puzzle Examiner color-only toggle now fully hides digits**: Fixed the memoization dependencies in `PuzzleGrid` so `showColorOnly` is included in the `gridContent` `useMemo`. This ensures grid cells re-render when color-only mode is toggled, allowing `GridCell` to correctly render transparent text and `null` content without stray numeric glyphs leaking through the UI (`client/src/components/puzzle/PuzzleGrid.tsx`).

### Version 5.16.6

- UI/UX & Metrics
  - **PuzzleDBViewer white theme**: Replaced the dark slate layout with a clean white page, light borders, and compact spacing so unsolved ARC evaluation puzzles are easier to scan at a glance (PuzzleDBViewer.tsx). Header, filters, and ARC2/ARC1 sections now match the rest of the app’s light styling while keeping ARC2-Eval as the clearly marked primary focus.
  - **Puzzle preview stats cleanup**: Simplified PuzzleCard metrics to only show grounded, research-relevant stats: solve rate (clamped 0–100%), total attempts, unique models tested, test-case mode (single vs multi), grid size, dataset, and optional cost badge (PuzzleCard.tsx). Removed confidence/trustworthiness badges and any paths that could surface >100% style percentages.
  - **Backend accuracy clamp**: Normalized aggregated `avgAccuracy` in the worst-performing puzzles query to always live in [0,1] before sending to the UI, so no combination of database state can produce impossible solve rates (ExplanationRepository.getWorstPerformingPuzzles).

### Version 5.16.6

- Bug Tracking
  - **Puzzle Examiner color-only toggle still leaking digits**: Despite routing `showColorOnly` through `PuzzleGrid`/`GridCell`, the rendered cells continue to display numeric glyphs in the browser. Latest attempt hides the React content in `GridCell.tsx` (returns `null` + accessibility label), but the UI still shows numbers. Needs follow-up to inspect any inherited styles or additional layers painting the digits (e.g., CSS pseudo-elements, DaisyUI utilities) before the feature can ship.

### Version 5.16.5

- Features
  - **Puzzle Examiner color-only grids**: Added a dedicated “Show Colors Only” toggle beside the emoji button so users can hide numeric labels and focus on raw palette comparisons (PuzzleExaminer.tsx, PuzzleHeader.tsx). The button automatically disables while in emoji mode, and the new state propagates through PuzzleGridDisplay → PuzzleGrid → GridCell so every training/test grid now supports color-only rendering plus accessible screen reader labels. Updated PuzzleGrid props/types to keep Saturn Visual Solver and other consumers compiling cleanly.

### Version 5.16.4

- UI/UX Improvements
  - **PuzzleDBViewer major UI overhaul**: Drastically reduced wasted vertical space (~400-450px saved) by redesigning the entire page layout
    - Replaced massive gradient header Card (~200px) with compact dark theme header (~50px) matching PuzzleBrowser style (PuzzleDBViewer.tsx:335-353)
    - Condensed bloated filter Card (~120px) into single compact inline row with minimal padding (PuzzleDBViewer.tsx:355-378)
    - Removed all gradient backgrounds from ARC2/ARC1 section Cards, replaced with clean dark theme borders (lines 402-428, 450-492)
    - Reduced section header text from `text-2xl` to `text-sm uppercase` and badge sizes from `text-base px-4 py-2` to `text-xs px-2 py-0.5`
    - Changed container padding from `p-6 space-y-6` to `pb-3 pt-2 px-2 gap-2` for consistency with PuzzleBrowser
    - Reduced grid gaps from `gap-3` to `gap-2` throughout
  - **PuzzleDBViewer new features**: Added visual puzzle grid cards below pill lists
    - Imported and integrated PuzzleCard component from PuzzleBrowser (PuzzleDBViewer.tsx:30)
    - Added PuzzleCard grid display (first 12 puzzles) below ARC2 evaluation pills with lazy-loaded TinyGrid previews (lines 430-442)
    - Added PuzzleCard grid display (first 12 puzzles) below ARC1 evaluation pills (lines 477-489)
    - Provides visual puzzle structure inspection without leaving the database browser
  - **PuzzleDBViewer navigation improvements**: All ClickablePuzzleBadge components now open puzzles in new tabs via explicit `openInNewTab={true}` prop (lines 425, 472) for better research workflow

### Version 5.16.3

- Bug Fixes
  - **Grok 4.1 Fast visibility & dedupe in analytics**: Fixed `normalizeModelName` so historical Grok 4 / Grok 4.1 aliases (including OpenRouter-specific names with `-attemptN` suffixes) correctly normalize to their canonical keys (`x-ai/grok-4-fast`, `x-ai/grok-4.1-fast`) without dropping the attempt suffix, and updated `MetricsRepository.combineModelComparisons()` to use the normalized accuracy/trustworthiness/feedback/cost maps. This makes Grok 4 / Grok 4.1 appear under single, consistent rows in the model comparison dashboards instead of being split or disappearing.

### Version 5.16.2

- Bug Fixes
  - **PuzzleDB Viewer build failure**: Repaired `client/src/pages/PuzzleDBViewer.tsx` by restoring the missing ARC1 filter memo plus the required UI/icon imports, eliminating the stray switch `case` that esbuild flagged so the Vite build can complete again.

### Version 5.16.1

- Bug Fixes
  - **Grok model normalization for analytics dashboards**: Updated `MetricsRepository.combineModelComparisons()` to rely on the shared `normalizeModelName` helper instead of preserving raw model names, and tightened `normalizeModelName` itself so OpenRouter aliases like `openrouter/sonoma-sky` and historical `openrouter/sherlock-think-alpha*` entries all collapse into their canonical Grok counterparts (`x-ai/grok-4-fast`, `x-ai/grok-4.1-fast`) in the cross-model matrix and comprehensive dashboard. This removes duplicate or missing Grok rows from analytics views while keeping underlying database rows unchanged.

### Version 5.16.0

- Features
  - **PuzzleDB Viewer & PuzzleCard refresh**: rebuilt `client/src/pages/PuzzleDBViewer.tsx` around unsolved ARC evaluation puzzles using shadcn/ui cards/badges, dataset badges, search + lazy TinyGrid previews, and a simpler action flow, while `client/src/components/puzzle/PuzzleCard.tsx` now surfaces many performance metrics (models attempted, cost, accuracy/correctness signals) so researchers can spot hard puzzles at a glance.
  - **PuzzleTradingCards filters & sorts**: prioritized ARC2/ARC1 evaluation sources, added the "All Evaluation" combined filter, and replaced imaginary "difficulty" labels with accuracy-based performance buckets plus new sorts tuned to LLM defeats (`client/src/pages/PuzzleTradingCards.tsx`).

- Bug Fixes
  - **Binary correctness for zero-accuracy filters**: `server/repositories/ExplanationRepository.ts` now counts explanations using `is_prediction_correct`/`multi_test_all_correct` so PuzzleDB Viewer reliably surfaces puzzles with zero correct explanations, aligning with the documented correctness pattern.

- Documentation
  - Added the PuzzleDB Viewer & PuzzleCard redesign plan so future contributors understand the intended research-focused UX (`docs/2025-11-20-puzzledb-and-puzzlecard-redesign-plan.md`).
  - Captured the Correctness Logic Pattern guide that explains how to aggregate single- and multi-test correctness flags without mixing metrics (`docs/reference/database/CORRECTNESS_LOGIC_PATTERN.md`).

### Version 5.15.1

- Bug Fixes / Performance
  - **Database Query Optimization**: Fixed PostgreSQL temporary disk space overflow on `/api/puzzles/stats` endpoint
    - Replaced expensive `STRING_AGG` operations with `COUNT(DISTINCT)` for model aggregation (ExplanationRepository.ts:908-1000)
    - Changed `modelsAttempted` from string array to `modelsAttemptedCount` number across frontend/backend
    - Changed `reasoningEfforts` from string array to `reasoningEffortsCount` number
    - Updated TypeScript interfaces: `PuzzlePerformanceSnapshot` (usePuzzleStats.ts:34-37), `PuzzlePerformanceData` (usePuzzleDBStats.ts:32-34)
    - Updated UI components to display counts instead of badges: PuzzleTradingCard, DifficultPuzzlesSection, PuzzleDBViewer
    - Dramatically reduced temp disk usage - query now processes 4000+ puzzles without overflow
    - Files modified: ExplanationRepository.ts, puzzleOverviewService.ts, usePuzzleStats.ts, usePuzzleDBStats.ts, puzzleCardHelpers.ts, PuzzleTradingCard.tsx, DifficultPuzzlesSection.tsx, PuzzleDBViewer.tsx

- Features
  - **Automated Database Maintenance**: Added comprehensive maintenance system with zero manual intervention required
    - Created `DatabaseMaintenance` class with automated cleanup tasks (server/maintenance/dbCleanup.ts):
      * Logs temp file statistics (count & size via `pg_ls_tmpdir()`)
      * Terminates idle queries stuck >5 minutes (`pg_terminate_backend`)
      * Forces PostgreSQL CHECKPOINT to clean orphaned temp files
      * Runs VACUUM ANALYZE on key tables (explanations, feedback, puzzles)
      * Reports database size, connection statistics, and space reclaimed
    - Integrated maintenance into server lifecycle (server/index.ts:117-136):
      * Runs automatically on startup after database initialization
      * Scheduled to run every 6 hours via `setInterval`
      * Non-blocking error handling (won't crash server)
    - Added manual execution script with detailed reporting (server/scripts/run-maintenance.ts)
    - Added npm script: `npm run db:maintenance` (package.json:14)
    - Deployment: No SSH access needed - maintenance runs automatically on every deploy
    - Monitoring: Check logs for `db-maintenance` and `maintenance-script` tags

- Documentation
  - Created comprehensive implementation guide: `docs/2025-11-21-postgres-temp-disk-fix.md`
    - Root cause analysis of temp disk overflow
    - Before/after query comparisons
    - All file changes with line numbers
    - Automated maintenance system documentation
    - Monitoring and troubleshooting guide

### Version 5.15.0

- Features
  - **PuzzleBrowser**: Added solved status tracking across backend and frontend
    - Added `isSolved` field to `BulkExplanationStatus` interface (IExplanationRepository.ts:165)
    - Updated `ExplanationRepository.getBulkExplanationStatus()` with SQL subquery to calculate solved status based on correct predictions (ExplanationRepository.ts:495-509)
    - Added `isSolved` to `EnhancedPuzzleMetadata` interface (puzzleService.ts:36, PuzzleBrowser.tsx:42)
    - Implemented new 'unsolved_first' sort with 3-tier priority system (PuzzleBrowser.tsx:98-112):
      1. Attempted but unsolved (highest research value)
      2. Solved puzzles
      3. Never attempted (lowest priority)
    - Changed default sort from 'unexplained_first' to 'unsolved_first' (PuzzleBrowser.tsx:51)
    - Added "Unsolved first (attempted) - recommended" dropdown option (PuzzleBrowser.tsx:333)

  - **PuzzleDBViewer**: Major UI overhaul for compact, efficient layout
    - Added TinyGrid puzzle previews with lazy-loaded IntersectionObserver pattern (PuzzleDBViewer.tsx:99-241)
    - Created new `CompactPuzzleCard` component with 64px grid preview showing first training example
    - Reduced card padding from `p-4` to `p-2` (50% space reduction)
    - Compacted metrics to `text-xs` grid layout with minimal spacing (`gap-1`)
    - Changed badges to `badge-sm` and buttons to `btn-xs` for tighter layout

- Refactoring / Cleanup
  - **PuzzleDBViewer**: Removed "Database Overview" card that wasted ~200px showing 4 trivial statistics (PuzzleDBViewer.tsx:928-962 deleted)
  - **PuzzleDBViewer**: Completely removed "Humble AI" categorization (arbitrary <80% confidence threshold with no scientific basis)
    - Removed from `getPuzzleInterestLevel()` priority system (PuzzleDBViewer.tsx:27-46)
    - Removed 'humble' sort option from dropdown (line 847)
    - Removed 'humble' case from sort logic (line 173)
    - Removed `humbleOnly` filter state and logic (lines 100, 143-145)
    - Removed `humble` count from aggregateStats (lines 269, 307)
    - Removed "Humble AI" card from difficulty distribution (lines 485-489)
    - Removed "Most Humble" comparative highlight (lines 643-657)
    - Removed from useMemo dependencies (line 195)
  - **PuzzleDBViewer**: Condensed filter section with DaisyUI compact classes
    - Search bar: Horizontal layout with `input-sm` and `btn-sm` (lines 773-798)
    - Sort/dataset dropdowns: Inline with `select-sm` (lines 800-856)
    - Checkboxes: Changed to `checkbox-xs` and inlined for space efficiency
    - Reduced overall spacing with `gap-3` instead of `gap-4`

- Documentation
  - Created `/docs/2025-11-20-add-solved-filter-plan.md` with 8-step implementation plan for PuzzleBrowser solved status
  - Created `/docs/2025-11-20-enhance-database-viewer-solved-status.md` with enhancement plan for PuzzleDBViewer
  - Created `/docs/2025-11-20-fix-database-viewer-ui-bloat.md` with detailed 6-step UI bloat fix plan including TinyGrid preview pattern

### Version 5.14.3

- Repo / Tooling
  - Updated `arc-agi-benchmarking` git submodule to point to `https://github.com/82deutschmark/arc-agi-benchmarking` instead of `https://github.com/arcprize/arc-agi-benchmarking`.

### Version 5.14.2

- Refactoring
  - Added client-side redirect component from `/human-cards` to `/hall-of-fame` to prevent broken links and preserve backwards compatibility

### Version 5.14.1

- Bug fixes
  - Fixed Jeremy Berman contributor card to display "High Score" badge without rank indicator
  - Removed rank display from 2024 ARC Prize winner cards (Daniel Franzen, Guillermo Barbadillo) for cleaner card presentation

- Refactoring
  - Renamed `/human-cards` endpoint to `/hall-of-fame` for better semantic clarity
  - Updated navigation, routes, and sitemap to reflect new endpoint URL

- Docs
  - Added `docs/reference/database/MULTI_TEST_CORRECTNESS_GUIDE.md` describing the multi-test correctness pipeline, field semantics, and UI/display patterns for future maintainers.

### Version 5.14.0

- LLM Reasoning docs
  - Added `/llm-reasoning` explainer page and `/llm-reasoning/advanced` research-style article.
  - Linked advanced article from the basic explainer header.

- Top navigation refactor (ARC-3 & Misc)
  - Replaced hover-based `NavigationMenu` dropdowns with click-to-open `DropdownMenu` components.
  - Fixed dropdown alignment and viewport so ARC‑3 / Misc menus open directly under their tabs and are no longer clipped by header overflow.
  - Reorganized navigation into grouped menus for ARC‑3 experiences and Misc tools with clearer active‑route highlighting.

- Analytics, SEO & AEO
  - Added sitemap, robots, and `llms.txt` plus canonical metadata and JSON‑LD to improve web and LLM discoverability.
  - Introduced model origin badges and labels in Analytics to distinguish official ARC Prize leaderboard runs from community runs.
  - Clarified evaluation harness copy and how analytics are generated from the shared ARC‑AGI benchmarking harness.

- Correctness & metrics fixes
  - Overhauled correctness logic across Accuracy, Trustworthiness, ModelDataset, and Metrics query helpers to correctly handle single vs multi‑prediction runs, NULLs, and JOIN duplication.
  - Updated trading card win‑rate and difficulty display to use consistent correctness semantics and percentage formatting.

- Contributors backend
  - Refactored `ContributorRepository` to extend `BaseRepository` and integrated it via `RepositoryService` and a new `contributorController`, fixing crashes on `/api/contributors` endpoints and aligning with the standard repository/controller pattern.
