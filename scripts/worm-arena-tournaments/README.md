# Worm Arena Tournament Scripts

One script: [`new-model-eval.py`](new-model-eval.py). It queues Worm Arena matches against the
`/api/snakebench/run-batch` endpoint, playing **both directions** per pairing. Replays land in
`external/SnakeBench/backend/completed_games/`.

## Usage

The dev server must be running (the user starts it — see CLAUDE.md).

```bash
python3 scripts/worm-arena-tournaments/new-model-eval.py \
  --model deepseek/deepseek-v4-flash-0731 \
  --baselines z-ai/glm-5.3-flash qwen/qwen3.8-flash \
  --count 3 --max-workers 4
```

Full round-robin over a pool (every unique pair once, both directions — no double billing):

```bash
python3 scripts/worm-arena-tournaments/new-model-eval.py --round-robin --count 2 \
  --model deepseek/deepseek-v4-flash-0731 \
  --baselines z-ai/glm-5.3-flash qwen/qwen3.8-flash deepseek/deepseek-v3.2
```

Always `--dry-run` first to print the match plan without firing.

| Flag | Default | Notes |
| --- | --- | --- |
| `--model` | `deepseek/deepseek-v4-flash-0731` | Slug under test |
| `--baselines` | current cheap-flash tier + DeepSeek V3.2 | Space-separated |
| `--count` | 3 | Matches per pairing; ×2 for both directions |
| `--round-robin` | off | Treat `--model` + `--baselines` as one pool; all unique pairs |
| `--max-workers` | 4 | Parallel pairings |
| `--num-apples` | 15 | |
| `--persona` | `B` | `default`, `A`, or `B` |

## Rules learned the hard way

- **A model must be registered in `server/config/models.ts` before it can play.**
  `getSnakeBenchAllowedModels()` gates `run-batch` and rejects anything else. See
  [the model refresh plan](../../docs/plans/082926-worm-arena-cheap-flash-models-plan.md) for the
  catalog-then-keys ordering, which will take the app down at boot if reversed.
- **No `:free` slugs.** Free tiers rate-limit, and a throttled match writes a zero-token replay
  that is invalid and has to be deleted — see
  [zero-token-games-report](../../docs/worm-arena/zero-token-games-report-2025-12-13.md).
  If you must use one, drop to `--max-workers 1`.
- **No `:batch` slugs** (different call semantics) and **no `~`-prefixed aliases** (they redirect,
  and TrueSkill keys off the slug, so ratings silently corrupt).
- **Check the model is a chat model.** The arena wants plain text ending in `UP`/`DOWN`/`LEFT`/
  `RIGHT`. Translation, music, safety-classifier, and vision-only models will not comply.
- **Cost comes from our own config**, not from OpenRouter — wrong `cost` strings in `models.ts`
  mean wrong `$` in every replay, silently.
- **Drive loops from Python, not the shell.** `${!ARR[@]}` array slicing is a bash-ism that fails
  with `bad substitution` in zsh, the shell on this machine. That is why `--round-robin` lives in
  the script.
- **Smoke test one match before a sweep.** Observed burn across models spans 226 → 11,675 output
  tokens per round, a 50× range, so budgets are guesses until measured.

## History

36 one-off scripts were removed on 2026-08-29: 30 PowerShell files (unrunnable — no PowerShell on
the dev Mac), plus five hardcoded tournaments and a runner whose only purpose was free-model rate
limiting. All were pinned to models now long dead. Recover any from git history if needed.
