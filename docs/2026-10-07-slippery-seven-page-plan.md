# Slippery Seven page

Create `/arc3/slippery-seven` as a dedicated index of the seven games already identified
by `shared/arc3Games/slipperySeven.ts`. Reuse the game registry's screenshots, descriptions
and level counts; use opaque game IDs as headings and link each existing game guide.

Explain the name using the September 17 research note in arc-3:
`docs/trace-findings/2026-09-17-the-slippery-seven.md`. It refers to zero levels cleared
in four passes of the September 16 Qwen 27B run, not a current difficulty ranking.
Keep it distinct from the earlier Flash-Next bottom-seven cohort. Do not reproduce
outdated present-tense difficulty claims or create a second membership list.

Add the page to ARC-3 navigation, the games index, route metadata and sitemap.
Verify a production frontend build and the actual rendered page before committing
and pushing main. Automatic deployment handles publication; no deployment polling.

Completed: the production frontend build passed; local browser inspection confirmed
all seven game-guide links, loaded screenshots, dated research framing and the new
ARC-3 menu entry. The page reads the existing cohort directly and changes no game data.
