# 2025-12-01 – Poetiq Conversation-State Migration Plan

**Author:** Codex / GPT-5  
**Purpose:** Document how to migrate Poetiq’s prompt handling to the Responses API conversation model (mirroring the Discussion endpoint) while respecting Poetiq-specific behavior: multi-agent code generation, sandbox execution, and agent feedback loops. This plan explicitly references the relevant documentation files so other assistants know exactly where to look:

- `docs/reference/api/CONVERSATION-STATE.md` → describes our canonical Responses API usage and message ordering.
- `docs/29112025-solver-transparency-ui-plan.md` → transparency UI requirements that must stay accurate after this change.
- `docs/reference/api/RESPONSES_GUIDE.md` → SDK usage patterns for GPT‑5.x Responses API.

---

## 1. Goals

1. **Reuse our proven Discussion implementation:** Split prompts into system + structured conversation turns instead of concatenating everything into a single user string.
2. **Keep Poetiq’s uniqueness:** Multiple “agents” write Python code, the solver sandbox evaluates each attempt, and the sandbox feedback becomes conversational turns (not raw text pasted inside the next user prompt).
3. **Unlock GPT-5.1 / codex-mini features:** Responses API reasoning & conversation state require proper system/user roles; this plan aligns Poetiq with those expectations.

---

## 2. Current vs Desired Flow

| Aspect | Current Poetiq | Desired (Match `docs/reference/api/CONVERSATION-STATE.md`) |
| --- | --- | --- |
| System prompt | `solver_prompt` text glued into every user prompt | `instructions = solver_prompt` once per run |
| Puzzle data | Embedded directly inside the same user string | First user message: formatted train/test grids |
| Previous attempts | Also embedded in the user string | Represent each prior attempt as conversation turns: assistant = previous program output + scores; user = Poetiq feedback/critique |
| Sandbox feedback | Raw JSON text appended to the user message | Summarized user turn: “Here’s where you failed, please fix it” |
| Conversation state | Not tracked; every iteration re-sends everything | Keep thread of user/assistant turns, only append new feedback per iteration |

---

## 3. Implementation Plan

### 3.1 Backend Prompt Builder (mirror `server/services/prompts` discussion flow)

1. **Add `promptId: 'poetiq'`** to `PromptContext` & `systemPrompts.ts`.
2. **Construct conversation turns exactly like discussion:**
   - System = `SOLVER_PROMPT_*`.
   - First user message = puzzle grids (train/test).
   - For each agent iteration:
     - Assistant turn: previous code + Poetiq sandbox metrics (score, errors).
     - User turn: “Sandbox feedback” (summary string we currently glue into the prompt).
3. **Store conversation state per agent** (session + agent ID) so each agent’s `previousResponseId` chain is isolated.

### 3.2 Poetiq Wrapper Changes (reference `docs/reference/api/CONVERSATION-STATE.md#structured-messages`)

1. When an agent finishes an iteration:
   - Serialize sandbox results (`trainResults`, errors) into a concise assistant message.
   - Serialize “feedback” (current logic from `FEEDBACK_PROMPT`) into the next user message, *not* inline text.
2. Attach tokens/cost metadata to each turn to keep UI parity.

### 3.3 UI/Telemetry Adjustments (keep `docs/29112025-solver-transparency-ui-plan.md` accurate)

1. `promptData` events now include `messages[]` rather than one `userPrompt` blob—render them like the Discussion prompt viewer.
2. Prompt inspector shows structured conversation: system header, first puzzle user message, then alternating assistant/user turns per iteration.

---

## 4. Poetiq-Specific Notes

1. **Multiple agents:** Each Poetiq agent keeps its own conversation. That means one Responses API conversation per agent; they do *not* share message history (document this in `docs/reference/api/CONVERSATION-STATE.md` once implemented).
2. **Sandbox evaluation:** After each code execution we add a short assistant summary:
   - “Here’s the code I produced” (possibly truncated).
   - “Sandbox results: 2/3 passed, failure reason: color mismatch.”
3. **Feedback turn:** The existing `FEEDBACK_PROMPT` content becomes the next user message. This replicates Discussion behavior (“Here’s what you got wrong, please retry”).
4. **Voting/consensus:** Happens outside the LLM conversation. Once Poetiq selects the best agent, we still store the final code in the explanation record—no change.

---

## 5. Validation

1. Run a single-agent Poetiq session using the new conversation API and verify it matches Discussion payloads (system + messages).
2. Confirm GPT-5.1 and GPT-5.1 Codex Mini produce consistent reasoning summaries when conversation state is followed.
3. UI: prompt inspector should show per-turn sections similar to Puzzle Discussion.

---

## 6. Next Steps

1. Update `poetiq_wrapper.py` and `poetiqService.ts` to emit structured conversation events.
2. Refactor `usePoetiqProgress` to store `messages[]` per agent for UI replay.
3. Add integration tests ensuring conversation state is preserved across iterations/agents.

Once completed, Poetiq will leverage the same best practices already proven in Puzzle Discussion, while retaining its unique sandbox-driven insight loop. This unlocks full Responses API capability for GPT-5 Codex Mini and improves transparency for end users.***
