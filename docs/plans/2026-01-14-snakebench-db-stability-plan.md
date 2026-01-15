# 2026-01-14 SnakeBench DB Stability Plan

## Goal
Stop SnakeBench endpoints (suggest matchups, greatest hits) from crashing the server when PostgreSQL connections terminate unexpectedly. Provide graceful fallbacks so users do not lose matches or uptime.

## Scope
- Repository layer connection handling for idle/terminated PG clients.
- SnakeBench service/controller error handling for matchup suggestions and greatest hits.
- Non-goals: changing DB schema, adding new analytics, or altering match execution logic.

## Constraints
- Keep endpoints publicly accessible (no auth added).
- Avoid regressions in existing SnakeBench flows (matches, replays, leaderboards).
- Follow SRP/DRY; touch only necessary files.

## Tasks
1) **Reproduce/trace failure path**: Identify where `Connection terminated unexpectedly` bubbles, confirm whether Pool/Client error events are unhandled.
2) **Harden database client handling**: Add client-level error listeners and safe release logic so idle/terminated connections do not crash the process; ensure reconnection/retry where practical.
3) **Graceful fallbacks for SnakeBench reads**: Wrap curation/leaderboard calls used by `suggest-matchups` and `greatest-hits` so transient DB errors return curated/static data instead of crashing.
4) **Validation**: Run targeted checks (unit or manual) for `/api/snakebench/suggest-matchups` and `/api/snakebench/greatest-hits` to confirm 200 responses and no process crash when DB errors are simulated.

## Risks / Mitigations
- **Risk**: Multiple error listeners causing memory warnings. *Mitigation*: Attach once per client.
- **Risk**: Swallowing real outages hides incidents. *Mitigation*: Log structured errors with context and surface degraded-mode indicators in logs.

## Deliverables
- Code changes with required file headers.
- Updated CHANGELOG top entry (SemVer, what/why/how, author).
- Brief validation notes.
