# ARC-AGI Explainer – Developer Quick Reference

This is the single best starting point for the repo. High-signal synthesis from README/package.json/CLAUDE/AGENTS/CHANGELOG/etc.

## Mission
ARC-AGI puzzle explorer with AI explanations, ARC1/2/3, RE-ARC benchmarking, Worm Arena (SnakeBench LLMs vs LLMs), multi-provider (OpenAI Responses API, Anthropic, Gemini, xAI/Grok, DeepSeek, OpenRouter BYOK-prod).

Prod: arc.markbarney.net | Staging: arc-explainer-staging.up.railway.app (arc3 branch)

## Architecture
```
client/     React18+TS+Vite+Tailwind+shadcn/DaisyUI+TanStackQuery+Wouter
server/     Express+TS(ESM)+Drizzle(Postgres/in-mem)
shared/     types/schema/config/utils
data/       ARC datasets
solver/     Python (Saturn/Grover/Poetiq/Beetree)
external/   SnakeBench/re-arc/grover-arc
```
- tsconfig: strict/ES2020/bundler, paths `@/*=client/src`, `@shared=shared`
- vite.config.ts: root=client, aliases match tsconfig, STREAMING_ENABLED sync, Replit cartographer(dev)

## Commands (package.json)
```
dev    # Vite+Express
build  # client+server bundle
local  # build+dev
prod   # build+start
check  # tsc
test   # vitest watch (20s wait+joke)
test:* # unit/frontend/int/e2e/all/ui/coverage
db:push # Drizzle
*ingest # HF/Johanland
wormarena:* # tournaments/discover
snakebench:* # backfill
```
Windows: `windows-dev/start`

## Patterns
- ESM (.ts imports), repo pattern (no direct DB), promptBuilder+templates
- Headers(TS/Py): Author/Date/PURPOSE/SRP-DRY
- Workflow: Analyze>Plan(docs/plans/{date}-{goal}.md)>Impl>Verify>CHANGELOG(SemVer top)
- No mocks/any/placeholders; reuse shadcn/utils; prod BYOK

## Files
```
CLAUDE/AGENTS.md  # rules/workflow/scoring
CHANGELOG.md      # SemVer history
shared/types/schema # core
server/routes.ts  # API wiring
client/App.tsx    # routes
promptBuilder.ts  # prompts
repos/*           # data
services/*        # logic (AI/REARC/Worm/ARC3)
docs/*            # plans/ref
```

## Routes (Key)
**Frontend (Wouter)**: /task:id(Analyst def), /puzzle:id(Examiner), /re-arc(sub/dataset), /arc3(playground/codex/openrouter/haiku/games:id), /worm-arena(replay/live:id/matches/stats/models/skill/rules)
**Backend (Express)**: /api/health/models/puzzle/stream/analyze(rearc/snakebench/wormarena/arc3/council/og-image/metrics)

Full: README "Routes"

## Env (.env)
```
OPENAI_API_KEY
OPENROUTER_API_KEY (BYOK-prod)
DATABASE_URL
STREAMING_ENABLED
RE_ARC_SEED_PEPPER (32+)
SNAKEBENCH_*
```

## Scoring (ARC/RE-ARC)
**Truth**: arc-agi-benchmarking/scoring.py (score_task L36-125)
- Test case solved if *any* attempt matches GT
- Task score = solved_cases/total_cases
- Sub score = avg task scores (equal weight)
- JSON: array[test_pairs], each {attempt_1/2: {answer,pair_index,...}}

TS impl: reArcService.scoreTask matches py exactly

## Recent (CHANGELOG top)
- Worm: live/replay/leaderboard/insights/suggests (TrueSkill,30-apple)
- ARC3: agents(Codex/OR/Haiku), scorecards, harness py
- RE-ARC: gen/eval/sub/board (eff-plot,harness-parity)
- UI: Analyst dense-grid, BYOK enforce, OG-images

## Structured Outputs
### xAI Grok-4 (Oct7)
Responses API json_schema (grokJsonSchema.ts): req multiplePredictedOutputs/predictedOutput, opt predictedOutput1-3/conf; int[][] shallow; no min/maxItems/allOf. Fallback: retry no-schema on 400/422/503, parse output_text.

### OpenAI (Oct14)
Types: str/num/bool/int/obj/arr/enum/anyOf
Str: pattern/format(date-time/..uuid)
Num: multipleOf/max(min)/excMax(min)
Arr: min/maxItems

## Issues
- WS: Saturn conflicts
- DB: db:push verify
- Win: no && (PS equiv), no cd

See CLAUDE/AGENTS/CHANGELOG/docs for deep dives.