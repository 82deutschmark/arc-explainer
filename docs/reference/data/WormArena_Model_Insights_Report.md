Author: Codex (GPT-5)
Date: 2025-12-20
PURPOSE: Document the Worm Arena per-model actionable insights report, its data sources, and known gaps,
including the OpenAI summary step.
SRP/DRY check: Pass - documentation only.

# Worm Arena Model Insights Report

## Endpoint
- `GET /api/snakebench/model-insights?modelSlug=...`

## Scope
- Report uses the full history of completed games for the selected model.
- LLM summary is generated from aggregated stats only (OpenAI Responses API, gpt-5-nano-2025-08-07) using
  `instructions` plus `input` content blocks.

## Data sources
- `public.game_participants`
  - `result`, `score`, `cost`, `death_reason`, `death_round`
- `public.games`
  - `status`, `rounds`, `start_time`, `created_at`
- `public.models`
  - `model_slug`

## Summary metrics
- Games played, wins, losses, ties (counts across completed games).
- Win rate based on decided games only (wins and losses).
- Total cost and cost per game, win, and loss.
- Average rounds and average score for the model.
- Average loss round for losses only.
- Early loss count and rate (round <= 5).

## Failure modes
- Losses grouped by `death_reason`.
- Unknown loss reasons include rows where `death_reason` is null.

## Opponent pain points
- Opponents grouped by model slug, ranked by losses.
- In multi-opponent games, a single game contributes to each opponent entry.

## Data quality notes
- Loss reason coverage is the share of losses with a non-null `death_reason`.
- Provider errors and invalid responses are not yet captured as explicit failure reasons.

## Output fields (high level)
- `summary`: counts, rates, cost metrics, and data quality rates.
- `failureModes`: loss counts by reason plus share of losses and average death round.
- `lossOpponents`: top opponents by losses with loss rate and last played timestamp.
- `llmSummary`: short paragraph summary written by OpenAI (null if generation fails).
- `llmModel`: OpenAI model key used for the summary (null if summary is unavailable).
- `markdownReport`: markdown text used for copy and save actions.
- `tweetText`: preformatted short share text for Twitter.
