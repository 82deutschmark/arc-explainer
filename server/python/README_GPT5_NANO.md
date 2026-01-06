# ARC3 GPT-5 Nano Background Agent
The task list document is at: docs/plans/2026-01-04-arc3-gpt5-nano-background-agent-tasks.md That's the comprehensive one I created for the next developer—it has everything they need to know about what's done and what's left to do.
A lightweight Python agent that plays ARC3 games in the background using OpenAI's GPT-5 nano model. Designed to run while you sleep—no frontend, no TypeScript, just pure Python game playing.

## Quick Start

### 1. Install Dependencies

```bash
pip install openai anthropic pillow requests
```

Set environment variables:

```bash
export OPENAI_API_KEY="sk-..."
export ARC3_API_KEY="your-arc3-api-key"
```

### 2. Run a Single Game

```bash
# Play game "ls20" once
echo '{"game_id": "ls20"}' | python arc3_gpt5_nano_agent.py

# Or use the runner script (when ready)
python run_background_agent.py --game ls20
```

### 3. Play Multiple Games

```bash
# Play all 6 games once each
echo '{"games": ["ls20", "ft09", "sp80", "as66", "lp85", "vc33"]}' | python arc3_gpt5_nano_agent.py

# Play same game 5 times (when runner script ready)
python run_background_agent.py --game ls20 --runs 5
```

## How It Works

The agent uses the same **vision-first, child-like learning** approach as the Haiku agent:

1. **SEES** - Renders the game frame as a PNG image and describes it
2. **THINKS** - Forms a hypothesis about what will happen
3. **ACTS** - Chooses an action (ACTION1-6 or RESET)
4. **OBSERVES** - Notes what changed in the game
5. **LEARNS** - Updates its memory with the result

### Key Differences from Haiku Agent

| Aspect | Haiku Agent | GPT-5 Nano Agent |
|--------|-------------|------------------|
| LLM | Claude 3.5 Haiku | GPT-5 Nano |
| Use Case | Interactive playground | Background batch play |
| Integration | TypeScript frontend | Standalone Python |
| Cost | Higher | Very low |
| Speed | Slower | Very fast |
| Output | NDJSON + SSE | NDJSON only |

## Input Configuration

The agent reads JSON from stdin with these options:

```json
{
  "game_id": "ls20",
  "games": ["ls20", "ft09", "sp80"],
  "openai_api_key": "sk-...",
  "arc3_api_key": "...",
  "model": "gpt-5-nano",
  "max_turns": 80
}
```

- **game_id** (string): Single game to play
- **games** (array): Multiple games to play sequentially
- **openai_api_key** (string): OpenAI API key (or use env var)
- **arc3_api_key** (string): ARC-AGI-3 API key (or use env var)
- **model** (string): OpenAI model name, default `gpt-5-nano`
- **max_turns** (int): Max actions per game, default 80

## Output Format

The agent emits **NDJSON** (JSON Lines) events to stdout, one per line:

```json
{"type": "stream.init", "state": "starting", "agent": "gpt5-nano"}
{"type": "agent.starting", "game_id": "ls20", "model": "gpt-5-nano", "max_turns": 80}
{"type": "game.started", "game_id": "ls20"}
{"type": "agent.context", "turn": 1, "objects_count": 3, "score": 0, "state": "NOT_FINISHED"}
{"type": "agent.description", "content": "I see a blue square in the top-left..."}
{"type": "agent.hypothesis", "content": "I think ACTION1 will move the blue square..."}
{"type": "agent.tool_call", "action": "ACTION1", "coordinates": null, "turn": 1}
{"type": "agent.tool_result", "action": "ACTION1", "result": "executed"}
{"type": "game.frame_update", "frame": [...], "turn": 1}
{"type": "agent.observation", "content": "ACTION1 caused: Blue square moved 1 cell left", "turn": 1}
...
{"type": "game.won", "turn": 42, "score": 100, "observations": [...]}
{"type": "agent.completed", "final_score": 100, "turns": 42, "observations": [...], "actions_taken": 42}
```

## Logging

All output can be piped to a log file:

```bash
echo '{"games": ["ls20", "ft09"]}' | python arc3_gpt5_nano_agent.py > games_log.jsonl
```

Parse results:

```bash
# Extract only wins and losses
grep '"type": "game\.\(won\|over\)"' games_log.jsonl

# Pretty-print a single event
jq . games_log.jsonl | head -20

# Count total actions taken
grep '"type": "agent.tool_call"' games_log.jsonl | wc -l
```

## Reused Components

This agent reuses code from the existing Haiku implementation:

- **`arc3_haiku_preprocessor.py`** - Frame analysis and object detection
  - `extract_objects()` - Find shapes and objects in grid
  - `detect_changes()` - Summarize what changed between frames
  - `preprocess_frame()` - Full frame context extraction
  - `describe_objects_for_haiku()` - Generate natural descriptions

- **Arc3 API client pattern** - Matches existing implementation
  - `open_scorecard()` - Track game session
  - `start_game()` - Begin a new game
  - `execute_action()` - Perform an action and get result
  - `close_scorecard()` - Finalize tracking

This follows the **DRY principle**—no duplication of vision logic or game mechanics.

## Status & TODO

**Ready Now:**
- ✓ Core agent (`arc3_gpt5_nano_agent.py`)
- ✓ Vision-first game loop
- ✓ NDJSON event logging
- ✓ Frame rendering and preprocessing
- ✓ Reuses existing preprocessor

**TODO (Next Developer):**
- [ ] Cross-platform Python runner script (`run_background_agent.py`)
- [ ] Windows batch runner (`run_arc3_background.bat`)
- [ ] Log parser & analytics (`analyze_arc3_runs.py`)
- [ ] Systemd service for continuous background play
- [ ] Documentation updates
- [ ] End-to-end testing

See `docs/plans/2026-01-04-arc3-gpt5-nano-background-agent-tasks.md` for detailed task list.

## Example: Play All Games, Log Results

```bash
#!/bin/bash

# Run all 6 games once each, log to timestamped file
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="logs/gpt5_${TIMESTAMP}.jsonl"

mkdir -p logs

cat <<EOF | python arc3_gpt5_nano_agent.py | tee "$LOG_FILE"
{
  "games": ["ls20", "ft09", "sp80", "as66", "lp85", "vc33"],
  "model": "gpt-5-nano",
  "max_turns": 80
}
EOF

echo "Results logged to: $LOG_FILE"
echo "View wins: grep 'game.won' $LOG_FILE"
```

## Troubleshooting

**"openai package not installed"**
```bash
pip install openai
```

**"No input provided"**
```bash
# Don't forget the JSON config!
echo '{"game_id": "ls20"}' | python arc3_gpt5_nano_agent.py
```

**"API key required"**
```bash
export OPENAI_API_KEY="sk-..."
export ARC3_API_KEY="..."
```

**"Failed to start game: 403"**
- Check your ARC3 API key is valid
- Make sure you have access to the game ID (preview vs evaluation set)

**"PIL not available"**
```bash
pip install pillow
```

## Design Philosophy

This agent is intentionally **simple and focused**:

- **No ML training** - Uses LLM reasoning, not learned models
- **Minimal dependencies** - Only PIL, OpenAI, requests
- **Stateless between games** - Each game starts fresh
- **Background-friendly** - No interactive prompts, no frontend
- **Observable** - Every action logged, easy to debug
- **Reusable** - Can easily swap in different models or strategies

Think of it like a curious child learning the game by trial and error—fast, cheap, and effective for light exploration.

## Next Steps

1. Create the Python runner script (`run_background_agent.py`)
2. Test with a single game: `python run_background_agent.py --game ls20`
3. Run analytics: `python analyze_arc3_runs.py --log logs/`
4. Deploy as systemd service for continuous 24/7 background play

---

**Questions?** See `CLAUDE.md` section 7 for similar background game patterns, or check the task list in `docs/plans/`.
