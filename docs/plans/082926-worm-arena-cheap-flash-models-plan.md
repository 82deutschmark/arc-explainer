# Worm Arena — 2026 Cheap Flash Model Refresh

Date: 2026-08-29
Owner: Claude Opus 5
Status: Phase 1 DONE for 2 models (Nemotron 3.5 Lightning, DeepSeek V4 Flash). First match pending.

## Objective

Worm Arena has not run a match since **2025-12-15**. Register the current generation of
cheap OpenRouter reasoning models — headlined by **DeepSeek V4 Flash, GLM 5.3 Flash, and
Qwen3.8 Flash** — then run a measured batch of matches to see how the new cheap tier plays.

## 1. Where things stand

Verified against the live OpenRouter catalog (fetched 2026-08-29) and the local replay index:

| Fact | Value |
| --- | --- |
| Last match played | 2025-12-15 (`game_index.json`, 4,618 games) |
| Local catalog snapshot | 371 models, last synced ~2026-01 |
| Live OpenRouter catalog | 396 models |
| Models in catalog but not our roster | 357 |
| New + cheap (out ≤ $1/M, since 2026-01) | 62 |

DeepSeek alone shipped seven models we have never run: the whole **V4 Pro / V4 Flash**
generation. Our newest DeepSeek entry is V3.2 from 2025-12.

## 2. How the pipeline actually works

Traced end to end, because the ordering constraint in §3 falls out of it:

```
openrouter-catalog.json  ──▶ openrouterModels.ts (OPENROUTER_MODEL_KEYS)
                                      │  buildOpenRouterModels()
                                      ▼
                               models.ts  MODELS
                                      │
        ┌─────────────────────────────┼──────────────────────────────┐
        ▼                             ▼                              ▼
 modelAllowlist.ts            validators.ts                  snakebench_runner.py
 (gates run-batch)      (parses cost → pricingInput/Output)   (builds player_config)
                                                                     │
                                                                     ▼
                                                          llm_providers.py → OpenRouter
```

Three consequences that shape the plan:

1. **A model must be in `MODELS` before it can play.** `getSnakeBenchAllowedModels()`
   ([modelAllowlist.ts:22](server/services/snakeBench/helpers/modelAllowlist.ts:22)) builds the
   allowlist from `MODELS`; `validateModels()` rejects anything else. Registration is a hard
   prerequisite, not a nicety.
2. **Cost tracking comes from our own config, not from OpenRouter.**
   [validators.ts:147](server/services/snakeBench/helpers/validators.ts:147) parses the `cost`
   strings in `models.ts` and passes them to Python. Wrong pricing in config ⇒ wrong `$` in every
   replay, silently.
3. **The task is plain text, not tools.** The prompt ends with *"The final non-empty line of your
   response must be exactly one word: UP, DOWN, LEFT, or RIGHT."* No tool calls, no structured
   output. Any chat model can play — which is exactly why non-chat models must be kept out (§4).

## 3. The ordering constraint — read this first

[models.ts:1502](server/config/models.ts:1502) calls `buildOpenRouterModels()` at **module load**,
and that function **throws** if any slug in `OPENROUTER_MODEL_KEYS` is missing from the local
catalog snapshot:

```ts
if (missing.length) {
  throw new Error(`Missing OpenRouter catalog entries for: ${missing.join(', ')}`);
}
```

`MODELS` is imported by essentially the whole server. **Adding a key before the catalog contains
it takes the entire app down at boot** — not a failed match, a failed startup.

> **Order is: sync catalog → confirm slug present → then add the key.** Never the reverse.

## 4. Which models to add — and which to keep out

### Add (7 models, all paid, all general-purpose reasoning)

| Model | $in/M | $out/M | Context | Why |
| --- | --- | --- | --- | --- |
| `deepseek/deepseek-v4-flash-0731` | 0.045 | 0.090 | 1.31M | **The DeepSeek flash.** 284B MoE / 13B active |
| `z-ai/glm-5.3-flash` | 0.075 | 0.250 | 1.31M | **GLM 5.3 Flash.** Built for long-horizon agent tasks |
| `qwen/qwen3.8-flash` | 0.150 | 0.470 | 1.00M | **Qwen3.8 Flash.** Newest of the three (2026-08-26) |
| `qwen/qwen3.7-flash` | 0.030 | 0.130 | 1.00M | Prior Qwen flash at 1/4 the price — direct generational contrast |
| `nvidia/nemotron-3.5-lightning` | 0.080 | 0.200 | 262K | 30B MoE / 3B active, high-throughput agentic |
| `inclusionai/ling-3.0-flash` | 0.021 | 0.063 | 262K | **Cheapest general reasoning model on OpenRouter** |
| `upstage/solar-pro4` | 0.030 | 0.120 | 524K | Very cheap, long-horizon agentic |

`deepseek/deepseek-v4-pro-0813` ($0.66/$1.98) is **excluded by decision** — ~20× the Flash cost and
it dominates any budget it is in.

**Registered so far: `nvidia/nemotron-3.5-lightning` and `deepseek/deepseek-v4-flash-0731`.** The
other five are queued, not yet added — budget is $8 on the OpenRouter key, so the roster grows only
as matches justify it.

### Exclude — with the reason each one is a trap

| Excluded | Reason |
| --- | --- |
| **All `:free` variants** | Rate-limited in practice. A throttled match produces a corrupt replay, not a slow one |
| **All `:batch` variants** | Different call semantics — batch endpoints are not the interactive path the arena uses |
| `tencent/hy-mt2-1.8b`, `hy-mt2-7b`, `hy-mt2-30b-a3b` | **Translation models.** 8K context, no reasoning, no tools. Will not follow the move contract |
| `google/lyria-3-pro-preview`, `lyria-3-clip-preview` | Music generation, not chat |
| `nvidia/nemotron-3.5-content-safety:free` | Safety classifier, not a general model |
| `inclusionai/ling-3.0-flash-fin:free` | Finance-tuned *and* free — wrong on both counts |
| `~deepseek/deepseek-v4-flash-latest`, `~z-ai/glm-latest` | **Moving aliases.** TrueSkill keys off the slug, so a redirecting alias silently corrupts rating history |
| `deepseek/deepseek-v4-flash-vision-exp` | 7× the output price ($0.66 vs $0.09) for image understanding an ASCII board cannot use |
| `openrouter/auto-beta`, `openrouter/fusion`, `openrouter/pareto-code` | Routers with sentinel pricing (`-1000000`), not real models |

### Why the exclusion list needs enforcing by hand

`npm run sync-openrouter-catalog` auto-adds from the **top 10 newest** models, filtered only on
price (`input > $2` or `output > $3`). Run today, it would add **nine** slugs — including
`tencent/hy-mt2-1.8b` and `hy-mt2-30b-a3b` (translation), `z-ai/glm-5.3-flash:batch` (batch), and
`inclusionai/ling-3.0-flash-fin:free` (free + finance-tuned). It also *misses*
`deepseek/deepseek-v4-flash-0731`, which is dated 07-31 and falls outside the 10-newest window.

**So do not use the auto-add path.** `syncOpenRouterCatalog(false)` refreshes the catalog snapshot
without touching `OPENROUTER_MODEL_KEYS` at all. This also preserves the hand-written comment lines
in that array (e.g. `// anthropic/claude-haiku-4-6 — not in OpenRouter catalog yet`), which
`saveModelKeys()` would otherwise strip, since it rewrites the array from parsed keys only.

## 5. Phase 1 — register the models

```bash
node --import tsx -e "import('./server/scripts/sync-openrouter-catalog.ts').then(m => m.syncOpenRouterCatalog(false))"
```

If that command errors on import — importing the module pulls in `MODELS`, and a load-order
problem could trip the very throw described in §3 — fall back to the plain script and then discard
its key edits, keeping only the catalog refresh:

```bash
npm run sync-openrouter-catalog && git checkout server/config/openrouterModels.ts
```

That leaves the refreshed `openrouter-catalog.json` in place and throws away the nine auto-added
slugs, putting you back on the hand-picked path.

Then confirm all seven slugs landed in the snapshot **before** editing anything. Python, not
`node -e` — this repo is `"type": "module"`, so `require()` in a bare `node -e` throws:

```bash
python3 -c "
import json
c={m['id'] for m in json.load(open('server/config/openrouter-catalog.json'))['models']}
for s in ['deepseek/deepseek-v4-flash-0731','z-ai/glm-5.3-flash','qwen/qwen3.8-flash','qwen/qwen3.7-flash','nvidia/nemotron-3.5-lightning','inclusionai/ling-3.0-flash','upstage/solar-pro4']:
    print(('OK      ' if s in c else 'MISSING ')+s)"
```

Only once every line reads `OK`:

1. Add the seven slugs to `OPENROUTER_MODEL_KEYS` in [openrouterModels.ts](server/config/openrouterModels.ts), keeping the array sorted.
2. `git diff server/config/openrouterModels.ts` — verify **only** those seven lines were added and the comment lines survived.
3. Confirm the app still builds: `npm run build`. A throw here means step 1 ran out of order.

Pricing, context window, and reasoning flags are all derived from the catalog by
`buildModelConfig()`, so no hand-written cost strings are needed — which is also what keeps the
per-match `$` figures in the replays honest.

## 5b. First experiment — Nemotron vs DeepSeek (Gen Z streamer persona)

Two matches, both directions, persona `B` (the Gen Z Twitch streamer variant — already the script
default; `variant_registry.py` maps `B` → `llm_player_b.py`).

```bash
python3 scripts/worm-arena-tournaments/new-model-eval.py --count 1 \
  --model nvidia/nemotron-3.5-lightning \
  --baselines deepseek/deepseek-v4-flash-0731
```

Dry-run verified: 2 pairings, 2 matches, persona B. Requires the dev server on `localhost:5000`.

### Honest cost, against an $8 balance

| Scenario | $/match | 2 matches |
| --- | --- | --- |
| Median observed burn (1,064 out/rd, 19 rounds) | $0.009 | **$0.02** |
| p75 (3,167 out/rd, 40 rounds) | $0.046 | $0.09 |
| p90 (4,657 out/rd, 64 rounds) | $0.104 | $0.21 |
| Pathological (15k out/rd, all 150 rounds) | $0.699 | $1.40 |

**"Worst case" earlier meant p90 — a percentile from history, not a ceiling.** There is no
`max_tokens` cap on the `chat.completions` path these two models use (§6), so the true tail is
unbounded; the pathological row is an illustration, not a limit. Even at that rate it takes ~11
matches to burn $8. Two matches is safe under any of these; scale only after reading real burn.

**Note on reported cost:** `formatUsd` rounds to 2dp, so DeepSeek's $0.045/$0.090 is stored as
$0.05/$0.10 — replay `$` figures run ~11% high for this model. Affects reporting only, not billing.

## 6. Phase 2 — smoke test before committing

We have **zero** token-burn data for these seven models, and the observed spread across existing
models is **226 → 11,675 output tokens per round — a 50× range.** Every cost estimate below is a
projection until measured, so measure first.

Run **one** match per model against `deepseek/deepseek-v3.2` — the only legacy model kept (§7):

```bash
python3 scripts/worm-arena-tournaments/new-model-eval.py \
  --model deepseek/deepseek-v4-flash-0731 \
  --baselines deepseek/deepseek-v3.2 \
  --count 1 --max-workers 1
```

**Projected smoke cost: $0.15 median / $1.60 worst case** for all seven.

Then read the actual burn out of each replay:

```bash
python3 -c "
import json,glob,os
f=max(glob.glob('external/SnakeBench/backend/completed_games/snake_game_*.json'),key=os.path.getmtime)
d,_=json.JSONDecoder().raw_decode(open(f).read())
r=d['game']['rounds_played']
for p in d['players'].values():
    t=p['totals']
    print(f\"{p['name']:42} {t['output_tokens']/r:8.0f} out/round  {r:4d} rounds  \${t['cost']:.4f}\")"
```

**Sanity-check the printed `$` against the price table in §4.** `buildModelConfig()` derives cost
from the catalog entry, so a stale catalog silently yields stale pricing in every replay it writes
(§2, point 2). If the dollar figure is wildly off the table, the catalog entry is wrong — fix it
before running 112 more matches against bad numbers.

**Two failure modes this catches for a dime:**

- **Zero-token games.** `openai/gpt-5-mini` (n=92) and `allenai/olmo-3-32b-think:free` (n=13) both
  report 0 output tokens across our history, and
  [zero-token-games-report-2025-12-13.md](docs/worm-arena/zero-token-games-report-2025-12-13.md)
  documents these as invalid replays that get deleted. Find that on 1 match, not 112.
- **Runaway thinking.** Only `openai/`- and `x-ai/`-prefixed slugs get `api_type: "responses"` with
  `max_output_tokens: 16000` ([snakebench_runner.py:120](server/python/snakebench_runner.py:120)).
  DeepSeek, Qwen, Z-AI, NVIDIA all go down the uncapped `chat.completions` path
  ([llm_providers.py:270](external/SnakeBench/backend/llm_providers.py:270)). At $0.09–$0.47/M the
  *money* is irrelevant — but `glm-5.3-flash` advertises 131K max output per call, and an unbounded
  thinker across 150 rounds is hours of wall clock per match. **This is a time risk, not a cost
  risk.** If the smoke test shows a model burning >8K out/round, see §8.

## 7. Phase 3 — the tournament

**No legacy baselines.** The Dec-2025 roster (`gpt-5-nano`, `gpt-5.1-codex-mini`, `gpt-oss-120b`,
the free tier) is not what we are trying to learn about, and anchoring a 2026 field to it just
spends money re-measuring models we already have 4,618 games of. **The new tier plays itself.**

The single exception is **`deepseek/deepseek-v3.2`** — kept as one legacy anchor so V4 Flash vs
V3.2 gives a direct generational read, and so the new ratings connect to the existing TrueSkill
graph instead of floating free. It has n=31 games of history and costs $0.28/$0.42.

Full round-robin, 8 models, both directions, 2 matches per direction — one command:

```bash
python3 scripts/worm-arena-tournaments/new-model-eval.py --round-robin --count 2 \
  --model deepseek/deepseek-v4-flash-0731 \
  --baselines z-ai/glm-5.3-flash qwen/qwen3.8-flash qwen/qwen3.7-flash \
              nvidia/nemotron-3.5-lightning inclusionai/ling-3.0-flash \
              upstage/solar-pro4 deepseek/deepseek-v3.2
```

Verified by dry run: **28 unique pairs → 56 pairings → 112 matches**, matching the budget below.
Add `--dry-run` to print the plan without firing.

`--round-robin` was added to the script for this (it previously only did one-vs-many). It generates
each pair once and plays both directions, which is what stops a naive all-vs-all loop from billing
every matchup twice. It also replaces a shell loop that **silently fails in zsh** — `${!ARR[@]}`
is a bash-ism, and zsh is the shell here. Keeping the logic in Python removes that trap entirely.

**Expect an overnight run.** `--max-workers 4` caps concurrency at four pairings, so 56 pairings
land in roughly 14 waves. That is deliberate on first contact with seven unknown models — raise
`--max-workers` once the smoke test shows they behave.

### Budget

| Phase | Matches | Median | Worst case (p90) |
| --- | --- | --- | --- |
| Smoke test (each new model vs V3.2) | 7 | $0.15 | $1.60 |
| Round-robin, 8 models, 28 pairs | 112 | $1.50 | $17.30 |
| **Total** | **119** | **$1.65** | **$18.90** |

Derived from 1,107 observed player-sides in Dec-2025 replays: median 1,064 out/round × 19 rounds;
p90 4,657 out/round × 64 rounds. Zero-token sides excluded. A round-robin is *cheaper* than the
old-baseline sweep it replaces ($46.84 p90) and answers a better question.

## 8. Optional follow-up — cap output on non-OpenAI slugs

Only if the smoke test shows runaway generation. `build_player_config()` in
[snakebench_runner.py:98](server/python/snakebench_runner.py:98) sets `max_output_tokens` for
`openai/`/`x-ai/` slugs only. The fix is to pass a `max_tokens` for the rest so
`chat.completions` is bounded too. **Not a prerequisite** — the smoke test decides whether it is
needed at all.

## 9. TODO

- [ ] Sync catalog with `syncOpenRouterCatalog(false)`; verify the 7 slugs are present
- [ ] Add the 7 slugs to `OPENROUTER_MODEL_KEYS`; `git diff` to confirm nothing else moved
- [ ] `npm run build` to prove `buildOpenRouterModels()` does not throw
- [ ] Smoke test: 1 match per model vs `deepseek/deepseek-v3.2`; record real out/round
- [ ] Revise the budget table with measured numbers; get sign-off on the tournament
- [ ] Run the round-robin; confirm no zero-token replays landed
- [ ] `CHANGELOG.md` SemVer entry — **only** once code actually changes; this plan alone does not earn a bump

## 10. Already done — script cull (2026-08-29)

`scripts/worm-arena-tournaments/` held 38 files. **36 were deleted**, all git-recoverable:

- **30 PowerShell `.ps1` scripts** — there is no PowerShell on this Mac (`pwsh: not found`). They
  were unrunnable here, not merely stale.
- **5 hardcoded Python tournaments** (`champion-vs-field`, `deepseek-champions-vs-free`,
  `deepseek-vs-free-nano`, `free-vs-cheap`, `glm47`) — each pinned to dead free models
  (`arcee-ai/trinity-large-preview:free`, `nvidia/nemotron-3-nano-30b-a3b:free`,
  `xiaomi/mimo-v2-flash:free`, `openrouter/pony-alpha`).
- **`tournament-runner.mjs`** — existed solely to rate-limit free models, which we no longer use.
  Zero references anywhere in the repo.

**Kept: `new-model-eval.py`** — the only fully parameterized runner. Its defaults were dead
(`openrouter/pony-alpha` vs free baselines) and now point at the 2026 flash tier. `README.md` was
rewritten: it documented only the deleted scripts and none of the traps in §3–§4.

## Out of scope

- Starting the dev server. `new-model-eval.py` posts to `http://localhost:5000`, so the server must
  be running — but per CLAUDE.md that is the user's call, so the plan stops at the exact command.
- UI, leaderboard, and TrueSkill changes. Existing pages pick up new models automatically once the
  matches land.
- Backfilling the 422 replays referenced in `game_index.json` whose JSON files are missing locally.
