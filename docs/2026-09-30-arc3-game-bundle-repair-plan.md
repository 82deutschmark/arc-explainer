# Repair browser loading for the Arena glow-up games

Author: GPT-6 / Codex  
Date: 2026-09-30  
Status: Approved and implemented. Ready for commit/push and Railway deployment.

## Objective

Restore browser play for g304, g305, g306 and g309 while keeping Auto Research Arena as their authoring source and reusing the existing import and mirror paths.

## Confirmed findings

- Clicking START at `https://arc3.markbarney.net/arc3/play/g304` fails with `SyntaxError: from __future__ imports must occur at the beginning of the file`, line 13.
- The live g304 response ends with the exact local `server/data/arc3-games/g304.py` contents. Running the existing importer transformation in memory against `autoresearch-arena/arc3games/g304_crawler.py` reproduces that local file exactly. The published `sprite_book.py` also matches the stripped authoring source.
- `bundleSupportModules()` in `server/services/arc3Mirror/Arc3MirrorCatalog.ts` prepends executable helper registration to the game body. Python consequently rejects the game's otherwise valid future import.
- All four live source responses fail compilation for this same reason. Their current response versions are g304 `dbc63c47e551`, g305 `8d488999d1f3`, g306 `ef65c92cca14` and g309 `b7d5bef0f33d`.
- A scan of the authored manifest finds exactly these four games combining a future import with a local support import.
- `scripts/arc3/verify_probe_move.py` duplicates the faulty bundling pattern. Checks that import game files directly cannot detect this serving failure.
- The page appends WebAssembly/CDN advice to every load error, including this server-produced Python syntax error.

## Proposed implementation

1. Keep support-module registration in the existing mirror bundler, then compile and execute the unchanged game body as its own Python compilation unit in the existing game namespace. Encode the body using the existing base64 pattern and use a useful traceback filename. Keep compiler future flags isolated with `dont_inherit=True`. Games without bundled helpers retain the direct-source path.
2. Add regression coverage that obtains the real served payload through the TypeScript catalog and compiles/executes it, so validation exercises the production bundler. Use the shipped games and support modules. Check class lookup, initial render, action handling and reset for the four affected games, plus an existing helper-using game and a game without helpers.
3. Update the probe verification harness to consume production-generated payloads instead of maintaining a second bundler. Reuse the existing worker/Pyodide verification tools where practical.
4. Remove unconditional WebAssembly/CDN advice from the generic load-error message. Retain the underlying error and retry flow.
5. Update touched source headers, relevant verification documentation and the top changelog entry. Preserve unrelated work already present in this checkout.

## Validation and completion

- [x] Execute production-generated payloads for all 124 games in the three local catalogs.
- [x] Render, act and reset g304, g305, g306, g309, helper-using g007 and direct-source g001 with the real engine. Compare frames to the unchanged authored source; verify content hashes and preservation of direct-source payloads.
- [x] Production build passes. The full TypeScript check reports existing errors outside the changed files.
- Extended Pyodide/browser checks were stopped at Boss's request to commit and push promptly. The regression check and build above had already finished.
- Railway deploys the pushed main branch automatically.

## Implementation notes

`bundleSupportModules()` now compiles support modules and the unchanged game body as independent Python units with `dont_inherit=True`, in the same worker namespace. Source versions continue to hash the complete executable payload. `export_served_games.ts` provides the production payload to `verify_probe_move.py`, replacing its duplicate bundler. The play page retains the actual error and retry instruction without unconditional CDN advice. `tests/arc3MirrorBundles.test.ts` is runnable with `LOG_LEVEL=error node --import tsx --test tests/arc3MirrorBundles.test.ts` and requires the installed Python ARCEngine.

## Scope

The repair belongs in the packaging/serving path. Auto Research Arena's authored rules, levels and artwork already match the published g304 copy. Keep the existing stable game IDs and content-derived source-version contract; corrected executable payloads will naturally receive new source versions.
