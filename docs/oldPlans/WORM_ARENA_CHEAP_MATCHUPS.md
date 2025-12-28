# GPT-5.2 vs Cheap Models Matchup Generator

Generate Worm Arena matchups for GPT-5.2 playing against all models under a cost threshold.

## Quick Start

```bash
# Generate matchups with default settings (GPT-5.2 vs all models ≤ $5/M output tokens)
npm run worm:cheap-matchups

# Custom threshold (e.g., $2/M output tokens)
npm run worm:cheap-matchups -- "" 2.0

# Multiple rounds per matchup
npm run worm:cheap-matchups -- "" 5.0 3
```

## Arguments

1. **Reference Model** (default: `openai/gpt-5.2`)
   - The model key to generate matchups for
   - Example: `openai/gpt-5.2`, `anthropic/claude-opus-4.5`

2. **Max Output Cost** (default: `5.0`)
   - Maximum output token cost in dollars per million tokens
   - Example: `5.0` for $5/M, `2.0` for $2/M

3. **Rounds** (default: `1`)
   - How many times to repeat each matchup
   - Example: `3` for best-of-3

4. **Output File** (default: `gpt52_vs_cheap_matchups.txt`)
   - Where to write the matchup file
   - Example: `./my_matchups.txt`

## Examples

### Standard Setup
```bash
npm run worm:cheap-matchups
```
Output: `gpt52_vs_cheap_matchups.txt` with GPT-5.2 vs all models ≤ $5/M

### Budget-Conscious Testing
```bash
npm run worm:cheap-matchups -- "" 1.0
```
Only models under $1/M output tokens

### Best-of-3 Series
```bash
npm run worm:cheap-matchups -- "" 5.0 3
```
Each matchup plays 3 times for a series

### Custom Output Location
```bash
npm run worm:cheap-matchups -- "openai/gpt-5.2" 5.0 1 "external/SnakeBench/backend/model_lists/gpt52_matchups.txt"
```

## Output Format

Generates a text file compatible with SnakeBench's `dispatch_games.py`:

```
openai/gpt-5.2 gpt-4.1-nano-2025-04-14
openai/gpt-5.2 gpt-4o-mini-2024-07-18
openai/gpt-5.2 o3-mini-2025-01-31
...
```

Each line is a matchup ready for the SnakeBench game loop.

## Finding Cheap Models

Models with output cost ≤ $5/M include:
- **Free**: Gemma 3N, OLMo-3 32B, Devstral 2512, Nova 2 Lite, Kat Coder Pro
- **Nano/Mini**: GPT-5 Nano ($0.40), GPT-5 Mini ($2.00), GPT-4.1 Nano ($0.40)
- **Budget**: Gemini 2.5 Flash-Lite ($1.05), DeepSeek Chat ($0.42)
- **Under $5**: Claude 3.5 Haiku ($4.00), Claude Haiku 4.5 ($5.00)

## Integration with SnakeBench

1. Generate matchups:
   ```bash
   npm run worm:cheap-matchups
   ```

2. Copy the output file to SnakeBench:
   ```bash
   cp gpt52_vs_cheap_matchups.txt external/SnakeBench/backend/model_lists/
   ```

3. Run dispatch with the matchups:
   ```bash
   cd external/SnakeBench/backend
   python cli/dispatch_games.py gpt52_vs_cheap_matchups.txt
   ```

## Implementation Details

- Parses cost strings from `server/config/models.ts` (handles both simple and range formats like "$2.00 - $4.00")
- Skips the reference model if it appears in the opponent list
- Outputs in plain text format, one matchup per line
- Silent about excluded models (run with `--verbose` flag for details if added later)

## Model Cost Reference

Check `server/config/models.ts` for the authoritative cost list. Output costs shown:

| Model | Output Cost |
|-------|------------|
| gpt-5-nano-2025-08-07 | $0.40 |
| deepseek-chat | $0.42 |
| gpt-4o-mini-2024-07-18 | $0.60 |
| gemini-2.5-flash-lite | $1.05 |
| gpt-5-mini-2025-08-07 | $2.00 |
| claude-3-5-haiku | $4.00 |
| o3-mini-2025-01-31 | $4.40 |
| claude-haiku-4-5 | $5.00 |
