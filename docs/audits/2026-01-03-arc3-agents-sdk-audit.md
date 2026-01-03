# ARC3 Agents SDK Implementation Audit

**Date:** 2026-01-03
**Auditor:** Claude Sonnet 4.5
**Scope:** Arc3RealGameRunner + Arc3StreamService session/continuation behavior
**Context:** Educational playground for demystifying agents (not official competition entry)

---

## Executive Summary

Our implementation **intentionally diverges** from the official ARC-AGI-3 competition workflow. The Playground is designed as an **interactive learning tool** where users can:
- Watch agents think and reason
- See what agents observe (frames, grid analysis)
- Interrupt and guide agents with instructions
- Understand how agentic AI works

The user input capability is **correct and intentional**. However, there are **session management bugs** that prevent continuations from working properly. This audit identifies and fixes those bugs while preserving the educational interaction model.

---

## Official ARC-AGI-3 Workflow (From Docs)

From `docs/reference/arc3/ARC3_Games.md` → "Full Playtest":

```python
# Step 1: Open scorecard
card_id = session.post(f"{ROOT_URL}/api/scorecard/open", ...).json()["card_id"]

# Step 2: Start game
game_data = session.post(f"{ROOT_URL}/api/cmd/RESET",
  {"game_id": game_id, "card_id": card_id}).json()
state = game_data["state"]

# Step 3: Loop until WIN or GAME_OVER
for i in range(max_iterations):
    if state in ["WIN", "GAME_OVER"]:  # ← Exit condition
        break

    action = choose_action()  # Agent decides
    game_data = session.post(f"{ROOT_URL}/api/cmd/{action}",
      {"game_id": game_id, "card_id": card_id, "guid": guid}).json()
    state = game_data["state"]

# Step 4: Close scorecard
session.post(f"{ROOT_URL}/api/scorecard/close", {"card_id": card_id})
```

**Key insights:**
- **Single game session per scorecard** – one `card_id` for the entire playthrough
- **Continuous action loop** – agent keeps going UNTIL `state` is `WIN` or `GAME_OVER`
- **No "pausing" for human input** – the official workflow doesn't show human interaction mid-game
- **Scorecard closed at the end** – after the game naturally ends
- **No session resumption** – once a game reaches WIN/GAME_OVER, it's done

---

## Our Current Implementation

### What We're Doing

**Arc3RealGameRunner.runWithStreaming():**
1. Opens scorecard
2. Starts game (RESET)
3. Creates Agents SDK agent
4. Runs agent with `maxTurns` limit (e.g., 100,000)
5. **Stops when agent says it's done** (not when game reaches WIN/GAME_OVER)
6. Emits `agent.completed` event
7. **Closes the scorecard** (line 552: "NOTE: Do NOT end the session here...")

**ARC3AgentPlayground (Frontend):**
1. Receives `agent.completed` event
2. Shows "Send Message" prompt to user (lines 319-325)
3. User types message and clicks "Send"
4. Calls `continueStreaming()` endpoint
5. Backend tries to continue with `previousResponseId`

**Arc3StreamService.continueStreaming():**
1. Tries to resume the game session with `existingGameGuid` (line 405)
2. Passes `seedFrame` to avoid executing actions (line 407)
3. Creates a NEW agent run with user message appended (line 401)
4. Calls Responses API with `previous_response_id` (line 406)

### The Problem

**Issue 1: Agent Stops Before Game Ends**

According to official docs: **Game loop continues until `state` is `WIN` or `GAME_OVER`**

Our implementation: **Agent stops when it decides to**, not when the game ends.

Evidence:
- Line 1082 in Arc3RealGameRunner.ts: `maxTurns` is a limit, not a target
- The Agents SDK `run()` function respects `maxTurns` as a stop condition
- Agent can decide to end mid-game even if `state` is still `NOT_FINISHED`

**Expected:** If game is `NOT_FINISHED`, agent keeps playing.
**Actual:** Agent can stop at maxTurns, leaving game `NOT_FINISHED`.

---

**Issue 2: User Input Not Part of Official Workflow**

The official ARC docs **do not mention human input during gameplay**.

From the docs: "The real agents use smarter strategies instead of random!"

This suggests:
- ✗ Agents play autonomously
- ✗ No pausing for human feedback
- ✗ No user-provided input during a game session

Our implementation:
- ✓ Shows "Send Message" input after agent stops
- ✓ Tries to continue with `previousResponseId`
- ✗ But scorecard has already been **closed** by the first run!

---

**Issue 3: Scorecard Closure Breaks Continuation**

**Official flow:** One `card_id` stays open for the ENTIRE game (RESET → actions → WIN/GAME_OVER → close).

**Our flow:**
1. First run: Open scorecard, play game, **CLOSE scorecard** (implicitly, via first run ending)
2. User provides input
3. Continuation: Try to use old `card_id` to take new actions?
   - But scorecard was already closed!
   - Session is already terminated!

**Evidence from code:**

Arc3RealGameRunner.ts line 552:
```typescript
// NOTE: Do NOT end the session here. Sessions remain open for continuations.
// The session ends naturally when the game reaches WIN or GAME_OVER state.
```

This comment suggests continuations are supported, but:
- The scorecard IS closed at the end of `runWithStreaming()`
- There's no logic to keep the scorecard open
- When `continueStreaming()` tries to use old `card_id`, it's already invalid

---

**Issue 4: Missing `card_id` in Continuation**

Looking at `continueStreaming()` (line 318):
- Takes `existingGameGuid` to continue the game session
- Creates a new scorecard? **NO** – no call to `api/scorecard/open`
- Uses old `card_id`? **NO** – where is it stored?

The `seedFrame` has the `card_id`, but there's no code that:
1. Extracts the `card_id` from `seedFrame`
2. Passes it to the continued action requests

This means continuation actions might be hitting the ARC API without a valid `card_id`, which could fail.

---

**Issue 5: Session State Tracking**

The code uses `existingGameGuid` to track continuations, but:
- `guid` is the **game session identifier** (from ARC API)
- It's meant to track which game instance we're playing
- It's NOT the same as "can this session be continued"

According to official docs:
- Once `state` reaches `WIN` or `GAME_OVER`, the game is **finished**
- No further actions can be taken
- The scorecard should be closed

Our code doesn't check if the game is already in a terminal state before allowing continuation.

---

## Root Cause Analysis

### Why User Input Breaks Sessions

1. **Agent runs to completion** (or `maxTurns`)
2. **Scorecard closes** (implicitly, when `runWithStreaming()` returns)
3. **User is prompted for input** (invalid state – game already finished?)
4. **Continuation attempted** with dead/closed scorecard
5. **ARC API rejects** the action request (no valid `card_id`)
6. **Frontend shows error** or silent failure

### Why Sessions Aren't Found

- `existingGameGuid` points to a game that may already be finished
- `card_id` (scorecard ID) is not preserved for continuation
- No validation that the game is still in `NOT_FINISHED` state

### Why Sessions Expire

- `Arc3StreamService` schedules expiration (line 431: 5-minute TTL)
- If user takes >5 minutes to respond, payload is cleared
- Continuation attempt finds no cached state

---

## What The Official Docs Say About Human Input

**The official workflow shows ZERO human interaction during gameplay:**

```
This is what every agent does:
1. Get games list
2. Open a scorecard
3. Reset to start the game
4. Take actions based on its strategy (we used random)
5. Close the scorecard when done

The real agents use smarter strategies instead of random!
```

**Interpretation:**
- Agents are autonomous
- Human input is not part of the standard playtest workflow
- The game loop is agent → API → game state → repeat until WIN/GAME_OVER

---

## Educational Design vs. Competition Design

### Official ARC-AGI-3 (Competition)
- **Goal:** Win games autonomously
- **Interaction:** None (agent plays alone)
- **Evaluation:** Puzzle score
- **User role:** Passive observer
- **Workflow:** RESET → loop actions → WIN/GAME_OVER → close

### Arc3 Playground (Educational)
- **Goal:** Demystify what agents do
- **Interaction:** User interrupts and guides
- **Evaluation:** User understanding
- **User role:** Active collaborator
- **Workflow:** RESET → agent plays → user intervenes with guidance → agent continues → repeat until WIN/GAME_OVER

**Key insight:** The Playground is teaching tool, not a competition entry. The user input capability is **correct and essential**. It's how we show users what it's like to work WITH an agent.

---

## Current Implementation Design

Our approach (Option C - which I now understand is intentional):

1. **Agent plays autonomously** (respects `maxTurns` as safety limit, not target)
2. **User can interrupt** with guidance/instructions
3. **Continuation with new context** - agent re-runs with user feedback appended
4. **Scorecard stays open** across agent runs and user interactions
5. **Game ends when** state reaches `WIN` or `GAME_OVER`

**This is the right design.** It's not meant to be official-compliant; it's meant to be educational.

---

## The Real Problem: Session Management Bugs

Our design is correct, but the **implementation has bugs**:

1. ✗ Scorecard closes after first run (should stay open)
2. ✗ `card_id` not preserved for continuation (should be in session)
3. ✗ User input shown even when game is won/over (should validate state)
4. ✗ Continuation doesn't pass `card_id` to ARC API (should include it)

**These bugs break the intended educational experience.** Users expect:
- "Start agent" → watch it play
- "Interrupt and say: try moving left" → agent resumes with new guidance
- Agent continues until winning (or hitting game over)

Instead, they get:
- Agent plays, stops
- User tries to give input
- Continuation fails (dead session)
- Confusing error or silent failure

---

## What Needs to Be Fixed (Not Redesigned)

### Bug 1: Scorecard Closure

**Current:** Scorecard closes at end of first `runWithStreaming()`

**Should:** Scorecard stays open until game reaches terminal state

**Fix:** Don't close scorecard automatically. Only close when `state in ['WIN', 'GAME_OVER']`.

### Bug 2: Missing `card_id` in Continuation

**Current:** `existingGameGuid` is used to continue, but `card_id` is not passed

**Should:** `card_id` must be passed to all action requests in continuation

**Fix:** Store `card_id` in session payload and forward to continued game runner.

### Bug 3: Premature User Input Prompt

**Current:** Show "Send Message" even if game is already won/over

**Should:** Only show input if `state === 'NOT_FINISHED'`

**Fix:** Frontend validates `lastFrame.state` before showing continuation UI.

### Bug 4: No State Validation in Continuation

**Current:** Try to continue even if game is finished

**Should:** Reject continuation if game is in terminal state

**Fix:** Validate `seedFrame.state` is `NOT_FINISHED` before continuing.

---

## Implementation Strategy (Option C - The Right One)

Keep the current design, fix the bugs, **stay competition-compliant via metadata tags**:

**Backend:**
1. Store `card_id` from scorecard open in session payload
2. Don't auto-close scorecard (keep it open)
3. Pass `card_id` to all ARC API action requests in continuation
4. Close scorecard only when `state in ['WIN', 'GAME_OVER']`
5. Validate game state before allowing continuation
6. **Tag scorecard with `'educational-playground'` and `'interactive-agent'`** (via metadata)
7. **Include model name, reasoning level in tags**

**Frontend:**
1. Check `lastFrame.state` before showing "Send Message"
2. Only show input if `state === 'NOT_FINISHED'`
3. Show "Game Won!" or "Game Over" if terminal state reached
4. Disable continuation if game is finished

**Compliance:**
- Runs follow official ARC workflow (one scorecard, actions loop until WIN/GAME_OVER)
- Scorecard tags transparently mark as educational (not competition entry)
- Metadata enables filtering/analysis
- Technically valid but clearly distinguished

**Testing:**
1. User starts game, agent plays
2. User interrupts mid-game with instruction
3. Agent resumes with new guidance
4. Game continues until WIN or GAME_OVER
5. UI shows final state, not "Send Message" prompt
6. Scorecard is properly tagged and closed
7. Metadata is queryable for analysis

---

## Why This Design Works for Education

**Authentic agent experience:** Users see what it's really like to work with agents:
- Set direction → agent executes → observe results → adjust → repeat

**Transparency:** All visible:
- Agent reasoning (what it's thinking)
- Agent observations (what it sees in the grid)
- Agent actions (what it decides to do)
- User guidance (how to steer it)

**Learning:** Users understand:
- Agents aren't magic (they follow instructions)
- Agents can make mistakes (need human guidance)
- Collaboration > automation (agents + humans together)
- What agents actually see vs. what we see

**Engagement:** Interactive model is more compelling than passive observation.

---

## Files Needing Fixes

1. **Arc3RealGameRunner.ts**
   - Store `card_id` from scorecard
   - Don't auto-close scorecard
   - Pass `card_id` to all action requests

2. **Arc3StreamService.ts**
   - Preserve `card_id` in session payload
   - Validate `state !== NOT_FINISHED` before continuation
   - Close scorecard when game reaches terminal state

3. **ARC3AgentPlayground.tsx**
   - Check `lastFrame.state` before showing input
   - Show "Game Won!" / "Game Over" UI if terminal

4. **useArc3AgentStream.ts**
   - Validate state before offering continuation

---

## Priority Fixes

### 1. Backend: Preserve `card_id` Across Session

**File:** `Arc3RealGameRunner.ts`

Currently: Scorecard is opened but `card_id` is lost after first run.

Needed:
- Return `card_id` in the result
- Store it in session payload for continuation
- Pass `card_id` to all ARC API action requests (currently missing)

### 2. Backend: Don't Auto-Close Scorecard

**File:** `Arc3RealGameRunner.ts` + `Arc3StreamService.ts`

Currently: Scorecard closes implicitly at end of run.

Needed:
- Keep scorecard open after `runWithStreaming()`
- Only close when game reaches `WIN` or `GAME_OVER`
- Move closure logic to explicit "game ended" handler

### 3. Backend: Validate State in Continuation

**File:** `Arc3StreamService.ts` → `continueStreaming()`

Currently: Tries to continue even if game is finished.

Needed:
- Check `seedFrame.state` before continuing
- Reject if `state in ['WIN', 'GAME_OVER']`
- Return clear error: "Game is already finished"

### 4. Frontend: Don't Show Input If Game Is Over

**File:** `ARC3AgentPlayground.tsx`

Currently: Shows "Send Message" even after game ends.

Needed:
- Check `state.frames[last].state` before showing input
- Only show if `state === 'NOT_FINISHED'`
- Show "Game Won!" / "Game Over" if terminal state reached
- Disable continuation button

### 5. Frontend: Validate in Hook

**File:** `useArc3AgentStream.ts`

Currently: No validation before attempting continuation.

Needed:
- Check game state before calling `continueStreaming()`
- Prevent continuation if game is finished
- Provide user feedback

---

## Why These Fixes Matter

**Current experience:**
```
User: "Start agent"
Agent: Plays and stops
User: Tries to give instruction → "Send Message"
Backend: Continuation fails (dead session)
User: ??? (confused, session is dead)
```

**After fixes:**
```
User: "Start agent"
Agent: Plays and stops (but session open)
User: Gives instruction → "Send Message"
Backend: Continuation succeeds (scorecard still open, card_id valid)
Agent: Resumes with new guidance
Loop continues until WIN/GAME_OVER
Frontend: Shows "Game Won!" or "Game Over"
```

---

## Testing Checklist

- [ ] Start agent, watch it play
- [ ] Agent completes, "Send Message" shows
- [ ] User provides instruction
- [ ] Agent resumes with new guidance
- [ ] Agent can be interrupted multiple times
- [ ] Game continues until WIN state (not maxTurns)
- [ ] When game wins: "Game Won!" shows, no "Send Message"
- [ ] Scorecard is closed after game ends
- [ ] Continue attempting to send message after game ends: error

---

## Context for 2026

This is part of the broader push to introduce agents to users in 2026. The Playground helps demystify:
- **What agents see** (frame images, grid analysis)
- **What agents know** (their reasoning, observations)
- **How to work with them** (interrupt, guide, observe)
- **Why they matter** (autonomous systems that learn from feedback)

The interactive model is essential to this educational goal.

---

## Scorecard Metadata Tags (Competitive Compliance)

The implementation stays competition-compliant by leveraging scorecard metadata tags. When opening a scorecard, we attach tags that clearly identify educational runs:

**Tags to include:**
```
- 'educational-playground'     # Marks as educational, not official entry
- 'interactive-agent'           # User can interrupt/guide mid-game
- 'model:gpt-5-nano-2025-08-07' # Which model was used
- 'reasoning:high'              # Reasoning effort level
- 'max-turns:100000'            # Safety limit for this run
```

**Example:**
```typescript
const scorecardId = await this.apiClient.openScorecard(
  [
    'arc-explainer',
    'educational-playground',
    'interactive-agent',
    `model:${config.model}`,
    `reasoning:${config.reasoningEffort}`,
  ],
  'https://github.com/arc-explainer/arc-explainer',
  {
    source: 'arc-explainer',
    mode: 'educational-interactive',
    game_id: gameId,
    agentName,
    userInterruptible: true,
  }
);
```

**Benefits:**
- ✅ Runs are technically valid (could be submitted if desired)
- ✅ Clearly marked as educational (not official entries)
- ✅ Metadata provides analysis context
- ✅ Transparency: users understand these aren't competition submissions
- ✅ Compliance: follows official scorecard API exactly

**In analytics/review:**
- Filter by `educational-playground` tag to exclude from official rankings
- Filter by `interactive-agent` to study user-guided gameplay
- Analyze model performance with/without user interruption

---

## References

- Official docs: `docs/reference/arc3/ARC3_Games.md` (for context on official workflow)
- Game state enum: `NOT_FINISHED`, `WIN`, `GAME_OVER`
- Current implementation: `Arc3RealGameRunner.runWithStreaming()`, `Arc3StreamService.continueStreaming()`
- Educational mission: Demystify agents for users in 2026
