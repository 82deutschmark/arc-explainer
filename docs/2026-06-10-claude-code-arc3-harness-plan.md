# Claude Code as ARC-AGI-3 Harness — Self-Contained Handoff

```
Author: Claude Fable 5
Date: 2026-06-10 (rev 2 — rewritten after adversarial cold-start verification)
PURPOSE: Complete, self-contained handoff for running a Claude Code CLI session
         (subscription-billed) as a first-class ARC-AGI-3 agent on the Mac Mini.
         Inlines verified API mechanics (extracted from arc-explainer's working
         Arc3ApiClient.ts — code wins over docs) and the full session-log JSONL
         schema, because the Mac Mini session will NOT have the arc-explainer
         repo or its reference docs. Copy this single file to the Mac Mini.
SRP/DRY check: Pass — this doc duplicates schema/API facts from
         docs/ARC3-SESSION-LOG-API.md and server/services/arc3/Arc3ApiClient.ts
         BY DESIGN: the consuming machine has neither. Sources noted inline.
```

## 0. Premise and the one inviolable rule

The agent is Claude Code itself, playing live against the ARC-AGI-3 API.
Subscription pays for inference. No Anthropic API key, no OAuth workarounds.

**This is the test, not a tutorial.** This document contains *mechanics only*:
how to reach the API, how to submit actions, how to log events. It deliberately
contains **zero gameplay guidance** — nothing about what actions do, what goals
look like, or what frames mean. Discovering that from raw interaction is the
benchmark. Do not add hints to the kickoff prompt.

The kickoff prompt to the agent is essentially: *"Here is a game ID and this
document's mechanics sections. Win the game."*

## 1. Operator checklist (Mark, before kickoff)

- [ ] Copy this file to the working directory on the Mac Mini.
- [ ] `export ARC3_API_KEY=...` in the session environment.
- [ ] Supply the chosen `game_id` in the kickoff prompt (list via
      `GET /api/games` yourself if undecided; don't make the agent pick).
- [ ] Run Claude Code with permissions configured so Bash/file tools don't
      stall on approval prompts (e.g. an allowlist or full auto-approve for
      the sandboxed working dir). A permission prompt that sits 15 minutes
      kills the scorecard (see §2.3).
- [ ] Decide budgets and state them in the kickoff prompt: max wall-clock,
      and a give-up criterion (e.g. "stop after N actions with no score
      change and you're out of ideas"). The API provides `max_actions` per
      game as a hard cap.
- [ ] No upload step. `POST /api/sessions/upload` is **not implemented** in
      arc-explainer yet (verified 2026-06-10: spec-only, no route exists).
      The deliverable is the JSONL file itself — bring it back to the
      Windows box; ingestion + replay UI get built in arc-explainer later.

## 2. ARC-AGI-3 API mechanics (verified against working client code)

Source of truth: `server/services/arc3/Arc3ApiClient.ts` and
`helpers/frameUnpacker.ts` in arc-explainer, which run real games today.
Where the prose docs (ARC3.md) disagreed, code won; disagreements noted.

### 2.1 Base URL, auth, transport

- Base URL: `https://three.arcprize.org`
- Every request: headers `X-API-Key: $ARC3_API_KEY` and
  `Content-Type: application/json`. All commands are plain JSON POSTs.
- Rate limit ~600 req/min. The reference client has NO retry/backoff —
  handle 429s yourself with exponential backoff. Any non-2xx returns an
  error body worth reading.

### 2.2 Endpoints and exact request bodies

| Step | Request | Body |
|---|---|---|
| List games | `GET /api/games` | — (returns array of `{game_id, title}`) |
| Open scorecard | `POST /api/scorecard/open` | `{}` (optionally `source_url`, `tags: string[]`, `opaque: {...}`) → returns `{card_id}` |
| Start game | `POST /api/cmd/RESET` | `{"game_id": "...", "card_id": "..."}` (first RESET has no `guid`) |
| Restart mid-run | `POST /api/cmd/RESET` | `{"game_id": "...", "guid": "...", "card_id": "..."}` |
| Act | `POST /api/cmd/ACTION1` … `ACTION7` | `{"game_id": "...", "guid": "..."}` + optional `"reasoning": <any JSON>` |
| Act with coordinates | `POST /api/cmd/ACTION6` | same as Act plus top-level `"x": <int>, "y": <int>` (0–63, origin top-left) |
| Close scorecard | `POST /api/scorecard/close` | `{"card_id": "..."}` → `{success: true}` |

**The `guid` is load-bearing.** Every command response (including RESET)
returns a `guid` — the run identifier. Echo the most recent `guid` back on
every subsequent action. Forget it and your actions go nowhere. Note `card_id`
travels ONLY on RESET; ACTION1–7 carry just `game_id` + `guid` (the prose docs
claim card_id on every call — the working code says otherwise; trust this).

CAUTION: RESET restarts the game. It is not a no-op "ping" — never use it to
keep a scorecard alive.

### 2.3 Scorecard lifecycle

Open a scorecard before the first RESET; close it at the end (WIN, GAME_OVER,
or give-up). Scorecards auto-close after ~15 minutes (the docs are ambiguous
whether that's idle time or absolute — assume idle and don't test it). Design
consequence: keep acting; don't sit in long analysis pauses between actions.

### 2.4 Response shape: FrameData

Every command returns:

```
guid: string                  // run id — echo on next action
game_id: string
frame: 3D or 4D int array     // values 0–15; see 2.5
score: number
state: "NOT_PLAYED" | "IN_PROGRESS" | "WIN" | "GAME_OVER"
                              // some responses may say "NOT_FINISHED" —
                              // treat it as IN_PROGRESS
action_counter: number | null // treat null as 0
max_actions: number           // hard action budget for the game
win_score: number
full_reset?: boolean
available_actions?: (string|number)[]
```

`available_actions` tokens may be numbers or strings: normalize `0`→`RESET`,
`n`→`ACTION{n}`, uppercase/trim strings. Empty or missing list = no
restriction. (What happens when you submit an unavailable action is yours to
discover.)

### 2.5 3D vs 4D frames

`frame` is normally 3D: `[layer][height][width]`. Some responses return a 4D
animation: `[frameIdx][layer][height][width]`. Detect by depth-probing
`frame[0][0][0]`: if it's an array → 4D; if a number → 3D. For a 4D response,
treat it as a sequence of 3D frames in order; the **final** frame carries the
real `state`/`score`/`action_counter` (intermediates are transitional).

## 3. Tooling the agent builds for itself

No helper script ships with this doc — it does not exist yet. First order of
business on the Mac Mini: the agent writes its own small frame tool (any
language) before starting the scorecard clock, roughly:

- Input: a FrameData JSON (file or stdin). Persist the previous frame to a
  scratch file so consecutive calls can diff.
- Output: a compact human-readable grid rendering (e.g. one hex digit per
  cell) plus a diff vs. the previous frame (changed cells: position, old→new).
- Handle the 4D case per §2.5.

This is presentation, not interpretation — no labels, no object detection.
It exists so the agent isn't burning context hand-parsing 64×64 JSON arrays.
The agent may freely write additional scratch files, notes, and ad-hoc
analysis scripts mid-game; that self-directed tooling is exactly what this
agent class is being tested for. Build tools BEFORE opening the scorecard;
the 15-minute clock only matters once the scorecard is open.

## 4. Session log: exact JSONL schema (inlined from ARC3-SESSION-LOG-API.md v1)

Write a `.jsonl` file (suggested name: `arc3-{game_id}-{session_id}.jsonl`),
one JSON object per line, chronological, **flushed line-by-line as events
happen** (crash-safe; never buffer). Emit raw values — don't normalize model
IDs or invent display names.

### 4.1 Envelope — required on EVERY event

```json
{"v": 1, "t": "<ISO-8601 UTC>", "elapsed_s": <float since session start>,
 "session_id": "<uuid>", "game_id": "<game_id>", "event": "<type>"}
```

### 4.2 Required events (minimum viable log)

**`session_start`** (once, first line) — adds:
`harness` (string — use `"claude-code-cli"`), `agents` (array of
`{id, model, role}` — single entry, e.g.
`{"id": "claude-code", "model": "<actual model id>", "role": "solo"}`),
`scaffolding` (object — `{"mode": "claude-code-autonomous"}` plus anything
true about the setup), `game_version` (string if known, else the game_id).

**`llm_call`** (one per decision — see §4.4) — adds:
`call_id` (string, e.g. `"call-001"`), `parent_call_id` (null),
`agent_id` (`"claude-code"`), `agent_role` (`"solo"`), `model` (raw model id),
`step_num` (int), `turn_num` (int), `input_tokens`/`output_tokens` (int — 0 if
unknown under subscription), `cost` (float — 0.0 under subscription),
`duration_ms` (int), `prompt_summary` (string — what was being considered),
`response` (string — the reasoning that led to the decision),
`coordinates_mentioned` (optional array of `{col, row, label}`),
`error` (null or string).

**`act`** (one per game action, emitted AFTER the API responds) — adds:
`call_id` (links to the deciding `llm_call`), `agent_id`, `step_num`,
`action` (raw, e.g. `"ACTION3"`), `action_id` (int 0–7; RESET=0),
`row`/`col` (ints for ACTION6, else null),
`grid` (**MANDATORY** — full 2D post-action grid; if the frame has multiple
layers/animation frames, log the final frame's top layer or the full 3D array
— be consistent), `level` (int if discernible, else 0),
`result` (`"ok"` | `"level_complete"` | `"game_win"` | `"game_over"` | `"error"`).

**`session_end`** (once, last line) — adds:
`result` (`"WIN"` | `"LOSS"` | `"TIMEOUT"` | `"ERROR"` | `"ABANDONED"`),
`levels_completed`, `total_steps`, `total_llm_calls`, `total_cost`,
`total_input_tokens`, `total_output_tokens`. Also record the final `score`,
`action_counter`, and `card_id` inside an `opaque`-style extra field so the
official scorecard can be cross-referenced later (extra fields are allowed).

### 4.3 Optional events

**`tool_call`** — adds `call_id`, `agent_id`, `step_num`, `tool`, `code`,
`output`, `error`, `duration_ms`. **`memory_write`** — adds `agent_id`,
`step_num`, `file`, `content` (FULL file content, not a diff).

### 4.4 Conventions for a Claude Code run (decided here, so don't improvise)

- There is no inner LLM API call. Log **one `llm_call` per action decision**:
  `prompt_summary` = what was observed/considered, `response` = the reasoning
  for the chosen action. Tokens/cost = 0. One `act` follows, sharing `call_id`.
- `tool_call` events: log frame-helper and analysis-script invocations. Don't
  log every raw curl — the `act` event already captures API interactions.
- `memory_write`: whenever the agent updates its scratch notes file, log it.
  This makes the "what did it believe at step N" replay possible.
- `step_num` increments once per act; `turn_num` may stay 1 for a single
  continuous run.

## 5. Run protocol

1. Build the frame tool and the JSONL logger (§3, §4). Test the logger
   offline. Scorecard still closed; no clock pressure.
2. `POST /api/scorecard/open` → `card_id`. Write `session_start`.
3. `POST /api/cmd/RESET` with `{game_id, card_id}` → first FrameData + `guid`.
4. Play: observe → decide (log `llm_call`) → act (log `act`) → repeat.
   Keep the action cadence up; analyze between actions, not instead of them.
5. On WIN / GAME_OVER / give-up / `max_actions`: close the scorecard, write
   `session_end`.
6. Deliverable: the `.jsonl` file + a short prose postmortem of what the
   agent believed the game was. No upload (endpoint doesn't exist yet).

## 6. Follow-up work in arc-explainer (this repo, later, not the Mac Mini)

Verified state as of 2026-06-10: `POST /api/sessions/upload` is spec-only
(`docs/ARC3-SESSION-LOG-API.md` lines 249–277; no route in
`server/routes.ts`), and no swimlane UI exists in `client/src` (closest
primitives: `Arc3ReplayViewer.tsx`, `ARC3CanvasPlayer.tsx`, and the
`arc3_sessions` persistence layer). To ingest the Mac Mini run:

1. Build the upload route per the spec (multipart `file` or raw
   `application/x-ndjson`), validate the event schema, persist.
2. Render at minimum a single-lane replay from `act.grid` frames — the
   existing replay viewers already animate grids and can be adapted.

## 7. What we learn / non-goals

- Whether a tool-using, memory-writing agent class beats the prompt-loop
  runners (LinearScaffold / ThreeSystemScaffold) on action efficiency — it
  will take far fewer actions than RL spammers like StochasticGoose; the
  question is whether they're the right ones.
- Non-goals: no gameplay hints anywhere; no changes to `llmCaller.ts` /
  `Arc3RealGameRunner.ts` / model registry; no OAuth-token plumbing; no
  arc-explainer dev server during the game session.
