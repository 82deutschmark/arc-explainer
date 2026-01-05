# ARC3 GPT-5 Nano Background Agent - Remaining Tasks

**Status:** Foundation created, integration needed
**Created:** 2026-01-04
**Author:** Claude Haiku 4.5

## Overview

A new Python agent (`arc3_gpt5_nano_agent.py`) has been created to play ARC3 games in the background using OpenAI's GPT-5 nano model. This is much lighter-weight than trying to do everything in TypeScript.

**Files Created:**
- `server/python/arc3_gpt5_nano_agent.py` - Main agent (620 lines)
- `server/python/run_arc3_background.sh` - Bash runner script

**Reuses:**
- `arc3_haiku_preprocessor.py` - Vision preprocessing (same as Haiku agent)
- Arc3 API client pattern from `arc3_haiku_agent.py`

---

## Core Tasks (Blocking)

### 1. Windows Batch Runner Script
**Priority:** HIGH
**Effort:** 15 min
**Depends on:** None

Create `server/python/run_arc3_background.bat` for Windows users.

**What to do:**
- Mirror the bash script logic in batch syntax
- Handle environment variables (`OPENAI_API_KEY`, `ARC3_API_KEY`)
- Create `logs/arc3_games/` directory if it doesn't exist
- Generate timestamp-based log filenames
- Support same arguments: `run_arc3_background.bat ls20 5`

**Acceptance criteria:**
- Works on Windows 10+
- Creates proper JSONL log files with timestamps
- User can run: `run_arc3_background.bat all 1` to play all 6 games once

---

### 2. Cross-Platform Python Runner
**Priority:** HIGH
**Effort:** 30 min
**Depends on:** None

Create `server/python/run_background_agent.py` - a pure Python script that doesn't require bash.

**What to do:**
- Read arguments: `python run_background_agent.py --game ls20 --runs 5 --model gpt-5-nano`
- Optionally read from YAML/JSON config file
- Create logs directory automatically
- Pipe config to agent script via subprocess
- Capture and multiplex output (console + file)
- Pretty-print key events (game started, won, over) in real-time

**Acceptance criteria:**
- Works on Windows, Mac, Linux without modification
- `python run_background_agent.py --help` shows usage
- Can specify: game(s), runs, model, max_turns, log directory
- Logs all NDJSON events + human-readable summary at end

---

### 3. Dependencies & Setup
**Priority:** HIGH
**Effort:** 20 min
**Depends on:** None

Ensure all required packages are documented and installable.

**What to do:**
- Check `requirements.txt` (or `pyproject.toml`) includes:
  - `openai` (for GPT-5 API)
  - `anthropic` (already required for Haiku agent)
  - `pillow` (PIL for image rendering)
  - `requests` (HTTP client)
- Create setup instructions in `docs/PYTHON_SETUP.md`:
  - `pip install -r requirements.txt`
  - Environment variable setup (`OPENAI_API_KEY`, `ARC3_API_KEY`)
  - Verify: `python -c "import openai, anthropic, PIL, requests; print('OK')"`

**Acceptance criteria:**
- Fresh venv can install all deps with one command
- Clear error messages if a package is missing
- Setup guide works for Windows/Mac/Linux users

---

## Integration Tasks (Medium Priority)

### 4. Log Parser & Analytics
**Priority:** MEDIUM
**Effort:** 45 min
**Depends on:** Task 2 (we need log files to parse)

Create `server/python/analyze_arc3_runs.py` to extract insights from NDJSON logs.

**What to do:**
- Parse NDJSON log files from `logs/arc3_games/`
- Summarize per-game results:
  - Game ID, final score, turns taken, win/loss
  - Actions used (ACTION1-6, RESET frequency)
  - Observations learned
- Aggregate stats:
  - Success rate per game
  - Average turns to win/lose
  - Model performance trends
- Output CSV or markdown table for easy viewing

**Example output:**
```
Game    Runs  Wins  Avg Score  Avg Turns  Success Rate
------  ----  ----  ---------  ---------  ------------
ls20    5     3     75         45         60%
ft09    5     2     60         62         40%
sp80    5     4     88         38         80%
...
```

**Acceptance criteria:**
- `python analyze_arc3_runs.py --log logs/arc3_games/ --output results.csv`
- Works with partial/incomplete logs (doesn't crash)
- Clearly shows which games the model struggles with

---

### 5. Systemd Service (Linux/Mac)
**Priority:** MEDIUM
**Effort:** 30 min
**Depends on:** Task 2

Create `server/python/arc3-agent.service` for running agent as background daemon on Linux.

**What to do:**
- Create systemd service file that:
  - Runs `python run_background_agent.py` with persistent config
  - Logs to `logs/arc3_games/systemd.log`
  - Auto-restarts on failure
  - Respects `OPENAI_API_KEY` and `ARC3_API_KEY` env vars
- Create installation instructions: `sudo cp ... /etc/systemd/system/`
- Status commands: `systemctl status arc3-agent`

**Acceptance criteria:**
- `systemctl start arc3-agent` runs agent in background
- `journalctl -u arc3-agent -f` shows live output
- Service respects environment variables
- Graceful shutdown on `systemctl stop`

---

### 6. Monitor Dashboard Integration (Optional)
**Priority:** LOW
**Effort:** 60+ min
**Depends on:** Task 4 (analytics working)

Optionally integrate agent runs into the existing dashboard/analytics UI.

**What to do:**
- Create API endpoint `GET /api/arc3/background-runs` that:
  - Lists recent background runs with stats
  - Shows per-game success rates
  - Streams live agent events if run is in progress
- Update frontend to display agent performance over time
- Create simple status page: "Agent is currently playing [game], turn 23/80, score 45..."

**Acceptance criteria:**
- Dashboard shows historical agent performance
- Can view detailed run logs (which actions, observations)
- Optional: realtime stream of current game (same as TypeScript playground, but persistent)

---

## Testing & Validation

### 7. Manual Testing Checklist
**Priority:** HIGH
**Effort:** 30 min per run
**Depends on:** Tasks 1-3

Before committing:

- [ ] Single game run: `python run_background_agent.py --game ls20`
  - Verify agent starts and takes actions
  - Check log file is created
  - Verify NDJSON events are valid JSON
- [ ] Multiple runs: `python run_background_agent.py --game ls20 --runs 3`
  - Verify all 3 games play sequentially
  - No crashes between games
- [ ] All games: `python run_background_agent.py --games all --runs 1`
  - Test with all 6 game IDs (ls20, ft09, sp80, as66, lp85, vc33)
  - Verify each starts and completes (or times out after 80 turns)
- [ ] Error handling:
  - Missing API key: should print clear error
  - Invalid game ID: should fail gracefully
  - Corrupted input JSON: should handle
- [ ] Log analysis: `python analyze_arc3_runs.py --log logs/arc3_games/`
  - Parse latest log successfully
  - Generate summary stats

---

## Code Quality Checklist

### 8. Code Review & Documentation
**Priority:** MEDIUM
**Effort:** 20 min
**Depends on:** All code tasks

Before merging to main:

- [ ] Agent code follows project standards:
  - File headers with Author, Date, PURPOSE, SRP/DRY check
  - No mock data (uses real ARC3 API)
  - Error handling for network timeouts, API errors
  - Comments where logic isn't obvious
- [ ] Runner scripts have clear usage docs
- [ ] All docstrings explain function purpose and args
- [ ] No hardcoded API keys or secrets in code
- [ ] SRP check: each file has one clear responsibility

---

## Optional Enhancements

### 9. Advanced Features (Nice-to-Have)

- **Adaptive difficulty:** Track which games are hard, prioritize them
- **Resume on interrupt:** Save state so agent can resume mid-game
- **A/B testing:** Run multiple models in parallel, compare performance
- **Cost tracking:** Log OpenAI API calls and estimate spend
- **Rate limiting:** Don't hammer the Arc3 API; add intelligent backoff
- **Replay generation:** Export winning games as viewable replay JSON
- **Hypothesis tracking:** Extract and persist learned game rules across runs

---

## Summary for Next Developer

**What works:**
- Core agent logic (vision-first learning, same as Haiku but using GPT-5 nano)
- Game loop and action execution
- NDJSON event emission for logging
- Frame preprocessing and change detection

**What needs work:**
1. **Runnable:** Create Windows + cross-platform runners (Tasks 1-2)
2. **Setup:** Document dependencies and installation (Task 3)
3. **Analysis:** Tools to understand agent performance (Task 4)
4. **Durability:** Systemd service for continuous background play (Task 5)
5. **Integration:** Optional dashboard integration (Task 6)
6. **Testing:** Validate agent actually plays games end-to-end (Task 7)
7. **Cleanup:** Code review and documentation polish (Task 8)

**Recommended order:**
1. Do Tasks 1-3 first (makes agent runnable)
2. Do Task 7 (validate it works)
3. Do Task 4 (see what the agent is learning)
4. Optional: Tasks 5-6 (long-term durability)
5. Task 8 (final polish)

**Key design decisions:**
- Agent is **pure Python**, no TypeScript involvement (lighter weight)
- Uses **GPT-5 nano** (fast, cheap for background play)
- Same **vision-first philosophy** as Haiku agent
- Logs everything as **NDJSON** for easy parsing
- Can **play multiple games sequentially** in one run
- Reuses **existing preprocessor** (DRY principle)

---

**Questions?** Check:
- `CLAUDE.md` section 7 (SnakeBench/Worm Arena notes) for similar background player patterns
- `arc3_haiku_agent.py` for reference implementation
- `arc3_haiku_preprocessor.py` for vision logic (reused here)
