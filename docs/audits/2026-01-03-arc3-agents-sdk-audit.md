# ARC3 Agents SDK Implementation Audit

**Date:** 2026-01-03
**Auditor:** Claude Sonnet 4.5
**Scope:** Arc3RealGameRunner + Arc3StreamService session/continuation behavior

---

## Executive Summary

Our implementation **diverges significantly** from the official ARC-AGI-3 workflow documented in the ARC API reference. The official workflow shows a continuous game loop until WIN/GAME_OVER, but our implementation stops agents early and asks for user input, causing session management issues.

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

## Is Human Input Allowed?

**According to the official docs: Not in the standard workflow shown.**

However, this doesn't mean it's impossible. Theoretically:
1. Keep scorecard open after first agent run
2. On user input, take the user's action via `api/cmd/[USER_ACTION]`
3. Return to agent for next decision
4. Continue loop until WIN/GAME_OVER
5. Close scorecard

**But our code doesn't do this.** Instead, it tries to run a second agent, which creates a new session entirely.

---

## Recommendations

### Option A: Strict Compliance (Recommended for MVP)

Follow the official workflow exactly:
1. **Remove user input capability** during gameplay
2. **Agent plays continuously** until `state` is `WIN` or `GAME_OVER` (not maxTurns)
3. **Close scorecard** when game ends naturally
4. Allow user to **start a new game**, not continue

**Implementation:**
- Remove "Send Message" UI
- Remove continuation flow
- Set agent to respect `state` field, not `maxTurns`
- Close scorecard when game reaches terminal state

**Pros:**
- Matches official workflow exactly
- No session management complexity
- Clear semantics (one game = one scorecard)

**Cons:**
- No human feedback capability
- Less interactive experience

### Option B: Hybrid Approach (More Complex)

Support human input mid-game while staying close to official workflow:

1. **Keep scorecard open** across multiple runs
2. **On user input:**
   - Execute user's action directly via ARC API (not via agent)
   - Return frame to user
   - Let user decide: "Run agent again" or "Give another action"
3. **Loop until WIN/GAME_OVER**
4. **Close scorecard** when done

**Implementation:**
- Store `card_id` with session
- Add route: `POST /api/arc3/stream/user-action` to execute user actions
- Keep game loop open until terminal state
- Multiple agent runs against same scorecard

**Pros:**
- Supports human-agent collaboration
- Stays closer to official semantics (one scorecard per game)

**Cons:**
- More complex state management
- New API routes needed

### Option C: Current Implementation (Needs Fixes)

Keep user input capability but fix the bugs:

1. **Don't close scorecard** after first agent run
2. **Pass `card_id` to continuation**
3. **Validate game state** before allowing continuation
4. **Check game hasn't reached WIN/GAME_OVER** before asking for input
5. **Continue against same scorecard**, not create new session

**Implementation:**
- Store `card_id` in session payload
- Skip scorecard close in first run
- Pass `card_id` to continuation requests
- Add validation: `if (lastFrame.state in ['WIN', 'GAME_OVER']) show "Game ended"`

**Pros:**
- Preserves current UX
- Minimal code changes

**Cons:**
- Still diverges from official workflow
- Complex session state tracking

---

## Questions for Product/Architecture

1. **Should agents be autonomous or interactive?**
   - Official docs: Autonomous (Option A)
   - Current UI: Interactive (Option B/C)

2. **If human input is desired, who decides the action?**
   - User picks action → agent observes?
   - Agent suggests action → user approves/rejects?
   - Free-form text → agent interprets?

3. **What's the terminal condition for a game?**
   - Official docs: `state` in `[WIN, GAME_OVER]`
   - Current code: `maxTurns` or agent stops

4. **Should one game = one scorecard (official)?**
   - YES: Simpler, matches official workflow
   - NO: Multiple runs per scorecard (complex)

---

## Immediate Fixes (High Priority)

1. **Fix scorecard closure:**
   - Don't close scorecard at end of `runWithStreaming()`
   - Keep it open for continuation

2. **Pass `card_id` to continuation:**
   - Store in session payload
   - Use in continued action requests

3. **Validate game state before user input:**
   - Check `lastFrame.state`
   - Only show "Send Message" if `state === 'NOT_FINISHED'`
   - Don't show if `state in ['WIN', 'GAME_OVER']`

4. **Handle terminal states:**
   - When game reaches WIN/GAME_OVER, close scorecard
   - Don't prompt for input

5. **Test continuation flow:**
   - Verify `card_id` is valid in continuation
   - Verify actions execute correctly
   - Verify game state updates properly

---

## Files Needing Changes

- `server/services/arc3/Arc3RealGameRunner.ts` – Don't close scorecard automatically
- `server/services/arc3/Arc3StreamService.ts` – Pass `card_id`, validate state
- `client/src/pages/ARC3AgentPlayground.tsx` – Don't show input if `state in [WIN, GAME_OVER]`
- `client/src/hooks/useArc3AgentStream.ts` – Validate state before offering continuation

---

## References

- Official docs: `docs/reference/arc3/ARC3_Games.md` (Full Playtest section)
- Game state enum: `NOT_FINISHED`, `WIN`, `GAME_OVER`
- Current implementation: `Arc3RealGameRunner.runWithStreaming()`, `Arc3StreamService.continueStreaming()`
