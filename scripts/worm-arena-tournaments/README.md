# Worm Arena Tournament Scripts

This folder contains PowerShell scripts for launching batch Worm Arena (SnakeBench) tournament matches between AI models.

## Overview

Each script queues multiple game matches asynchronously, firing them off with minimal delays to allow the backend to process them in parallel. Games are saved as JSON replays in `external/SnakeBench/backend/completed_games/`.

## Scripts

### `run-matches.ps1`
- **Purpose**: GPT-5 Nano vs all free OpenRouter models
- **Models A**: openai/gpt-5-nano
- **Models B**: 9 free models (Trinity Mini, Nova Lite, Kat Coder Pro, Nemotron variants, Kimi Dev, Ministral family)
- **Matches per pair**: 5
- **Total**: 45 matches

### `ministral-feud.ps1`
- **Purpose**: GPT-5 variants vs Ministral family
- **Models A**: openai/gpt-5-nano, openai/gpt-5-mini, openrouter/gpt-5.1-codex-mini
- **Models B**: Ministral 14B, 8B, 3B (2512)
- **Matches per pair**: 3 (both directions)
- **Total**: 54 matches

### `gpt-openai-feud.ps1`
- **Purpose**: All GPT OpenAI models on OpenRouter compete in round-robin
- **Models**: openai/gpt-oss-120b, openrouter/gpt-5.1-codex-mini, openai/gpt-5.1, openai/gpt-5-nano, openai/gpt-5-mini
- **Matches per pair**: 3 (both directions)
- **Total**: 60 matches

### `opus-vs-all.ps1`
- **Purpose**: Claude Opus 4.5 challenges Haiku and all GPT models
- **Models A**: anthropic/claude-opus-4.5
- **Models B**: claude-haiku-4.5 (3), all 5 GPT OpenAI models (15)
- **Total**: 18 matches
- **⚠️ WARNING**: Extremely expensive ($10-$105 estimated cost)

### `opus-vs-sonnet.ps1`
- **Purpose**: Quick Claude Opus vs Sonnet 4.5 matchup
- **Models**: anthropic/claude-opus-4.5 vs anthropic/claude-sonnet-4-5
- **Matches**: 3
- **⚠️ WARNING**: Expensive run

### `gpt5-vs-claude-gemini.ps1`
- **Purpose**: GPT-5 family battles Claude family and Gemini 3
- **Models A**: openai/gpt-5-nano, openai/gpt-5-mini, openrouter/gpt-5.1-codex-mini
- **Models B**: Claude Opus 4.5, Sonnet 4.5, Haiku 4.5 (all via OpenRouter), Gemini 3 Pro Preview
- **Matches per pair**: 3
- **Total**: 36 matches

## How to Run

1. Ensure the dev server is running (`npm run test`)
2. Run any script from PowerShell:
   ```powershell
   powershell -File "path/to/script.ps1"
   ```

## Key Points

- **Asynchronous**: All scripts use `Start-Job` to queue matches without waiting for completion
- **2-second delays**: Minimal delays between job submissions prevent backend overload
- **No waiting**: Scripts complete immediately; matches run in parallel on backend
- **Cost tracking**: Check completed game JSON files for actual cost tracking
- **Models via OpenRouter**: Most scripts use OpenRouter models (identified by `openai/`, `anthropic/`, `google/` prefixes)

## Creating New Tournaments

When designing a new tournament:

1. **Identify model families** from `server/config/models.ts`
2. **Count matchups**: (Model A count) × (Model B count) × (matches per pair)
3. **Create arrays** for Model A and Model B
4. **Nested loops**: Iterate A → B → matches per pair
5. **Use `Start-Job`** for async execution
6. **Add `Start-Sleep`** between submissions (500ms typical)
7. **Run immediately** - don't wait for jobs to complete

## Estimating Cost

- **Free models**: $0.00
- **Cheap models** (e.g., GPT-5 Nano): ~$0.02-$0.10 per match
- **Mid-tier models** (Claude Haiku): ~$0.10-$0.50 per match
- **Premium models** (Claude Opus): $0.50-$5.00+ per match

Multiply by number of matches to estimate total cost.

## Notes

- All scripts fire off matches rapidly - no sequential waiting
- Games run on the SnakeBench backend (Python subprocess)
- Results appear in completed_games JSON files as games finish
- Use Worm Arena UI to view replays once games are complete
