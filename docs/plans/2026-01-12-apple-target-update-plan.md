## 2026-01-12 – Apple Target Update Plan

**Goal:** Align SnakeBench’s win condition with ARC Explainer’s rule (game ends when any snake reaches 30 apples).

### Context
- `APPLE_TARGET` in `external/SnakeBench/backend/domain/constants.py` is still 50 from upstream.
- Engine rule enforcement (`SnakeGame.run_round`) references this constant to terminate games.
- Player prompts (`players/llm_player.py`) also read the same constant, so updating the single source keeps UX consistent.

### Tasks
1. **Update constant:** Change `APPLE_TARGET` to `30` in `domain/constants.py`, keeping header metadata compliant with repo rules.
2. **Verify propagation:** Confirm there are no hard-coded apple-target mentions elsewhere (prompt already references the constant).
3. **Housekeeping:** Since behavior changes, ensure we note it in `CHANGELOG.md` after implementation (SemVer top entry).

### Testing / Validation
- No automated tests cover the apple cap today; after change, run (or reason through) a quick local game to ensure `self.end_game` triggers once a score hits 30.

### Risks / Mitigations
- **Risk:** Other environments expecting 50-apple ladders. Mitigation: communicate change via changelog; future enhancement could make the target configurable.

Please confirm this plan so I can proceed with the update.
