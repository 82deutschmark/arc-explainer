# Glowed ARC3 Community Games Import Plan

Author: OpenAI Codex (GPT-5)
Date: 2026-09-05
PURPOSE: Import the completed Son Pham glow-up game set as standalone ARCEngine community-game Python files, preserving each active immutable version and making review provenance explicit.
SRP/DRY check: Pass — reuse the existing `data/community-games/sonpham/` catalog layout and the repository's existing static validation contract without changing runtime services.

## Approved scope

- Source only games whose canonical glow-up count is at least one after Cycle 27 closes.
- Exclude every remaining v1 seed and all internal research metadata, recordings, and evaluation ledgers.
- Keep one standalone Python file per active game under `data/community-games/sonpham/`.
- Add the repository-required file header to each imported Python file without changing game behavior.

## Verification

- Verify the source repository's canonical pool, checksums, schemas, deterministic replays, structural audit, and regression suite before export.
- Re-run the ARC Explainer static contribution rules: ARCBaseGame subclass, arcengine import, allowed imports, no forbidden execution or file APIs, no more than 2,000 lines, and no more than 500 KB.
- Compile and instantiate every exported game against the same ARCEngine runtime used by the source verifier.
- Confirm that the exported source body is byte-identical to the qualified source after removing only the required contribution header.
- Commit the import and open a reviewable pull request against the `arc3` staging branch; do not push directly to `main`.

## Files intentionally unchanged

- Runtime services, routes, database schema, and frontend components.
- Existing community games and production configuration.
- Internal source-repository research artifacts that are not runnable game files.
