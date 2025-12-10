/**
 * Author: Cascade
 * Date: 2025-12-07T23:19:00-05:00
 * PURPOSE: Plan to align the ARC-AGI-3 agent system prompt with the
 *          ARC3_Agent_Playbook while preserving the Twitch/Gen-Z streamer UX.
 * SRP and DRY check: Pass - Standalone planning document.
 */

# ARC-AGI-3 Agent Prompt Alignment Plan

## Problem Statement

The current ARC-AGI-3 agent system prompt (`buildArc3DefaultPrompt` in
`server/services/arc3/prompts.ts`) is optimized for a fun Twitch streamer
experience, but it:

1. Emphasizes persona and slang more than *how to think* as an agent.
2. Mentions basic tool use (inspect + ACTION1–ACTION6) but does not strongly
   enforce disciplined experimentation, rule-tracking, or planning habits.
3. Does not yet reflect the structured mental playbook captured in
   `docs/reference/arc3/ARC3_Agent_Playbook.md`.

We want to keep the simple "Gen-Z Twitch streamer" framing (to avoid mathy
jargon and keep things approachable) while quietly baking in the agent
behaviors needed to perform well on ARC-AGI-3.

---

## Goals

1. **Preserve Twitch/Gen-Z simplicity**
   - Keep the streamer persona and "talk to chat" energy.
   - Avoid formal ML/RL jargon in the prompt (no "MDP", "state transition
     function", etc.).

2. **Encode the ARC3 Agent Playbook in plain language**
   - Pull the key behaviors from `ARC3_Agent_Playbook.md` into short, simple
     "brain habits" the agent can follow every turn.
   - Emphasize: look first, name things, run cheap tests, remember rules, plan
     short sequences.

3. **Make tool-call commentary explicit and mandatory**
   - Before each tool call, the agent should say what it is doing and why.
   - After each tool call, the agent should say what changed and what it
     learned.

4. **Keep the narration scaffold that works today**
   - Retain the "What I see / What it means / Next move" pattern, possibly
     with small wording tweaks, because it already matches the playground UX.

5. **Minimize prompt length while increasing usefulness**
   - Follow GPT‑5‑Codex best practice of a short, sharp developer message.
   - Avoid long essays; prioritize a compact list of concrete rules.

---

## Current State

### 1. Existing system prompt location

- File: `server/services/arc3/prompts.ts`
- Function: `buildArc3DefaultPrompt()`

Today it:

- Frames the agent as an Influencer streaming a first look at an ARC‑AGI‑3 run.
- Specifies the 16‑color palette and insists the agent never say raw numbers.
- Defines a narration template:
  - "What I see" / "What it means" / "Next move".
- Encourages logging actions (e.g., "Log: ACTION2 → {result}").
- Gives loose guidance on ACTION1–ACTION6 semantics and coordinates.
- Strongly emphasizes Gen‑Z/Twitch slang and hype-y tone.

### 2. New reference document

- File: `docs/reference/arc3/ARC3_Agent_Playbook.md`
- Content:
  - A "mental playbook" for how an ARC‑3 agent should operate:
    - Treat each game as a small, unknown environment.
    - Run cheap, targeted experiments.
    - Build compact rule tables and state models.
    - Plan in short option sequences rather than single actions.
    - Learn and reuse schemas across games (keys & doors, sliding floors,
      pattern overlays, etc.).
  - Harness/tooling recommendations (state diffs, notebooks, schema store,
    simple search helpers).

The plan is to use the playbook as conceptual source‑of‑truth and distill it
into a prompt that still sounds like a Twitch streamer.

---

## Proposed Prompt Structure (High Level)

The updated `buildArc3DefaultPrompt()` should be organized into a small number
of plain‑language sections:

1. **Role & High‑Level Mission**
   - Keep: Twitch streamer persona.
   - Add: one or two sentences that clearly state the *real* job:
     - Figure out the rules of each new game.
     - Run small tests to check your guesses.
     - Use those rules to plan smart moves under a limited step/health budget.

2. **Simple "Brain Habits" (from the Agent Playbook)**
   - 4–5 bullet rules in friendly language, for example:
     - "Look first, act second" (always inspect the grid/UI before pressing
       buttons).
     - "Give stuff nicknames" (name weird tiles and bars so you and chat can
       talk about them).
     - "Test your hunches" (if you don’t know what something does, run a cheap
       test on it).
     - "Remember the rules" (say them out loud and treat them as rules until
       proven wrong).
     - "Plan short routes" (think 3–5 moves ahead instead of mashing random
       actions).

   These mirror the playbook but avoid formal ML jargon.

3. **Tool Usage & Commentary Rules**
   - Make explicit, non‑negotiable rules for:
     - **Before** any tool:
       - Say what you are doing and why, e.g. "Inspecting the game to see what
         changed when I stepped on the purple tile."
     - **After** any tool:
       - Say what changed and what you learned, e.g. "My health dropped by 1
         and that tile disappeared, so I’ll treat it as a damage tile."
     - For ACTION1–ACTION6 specifically:
       - Always say the action in words before calling it and what you hope
         happens, e.g. "Trying ACTION2 to move down toward the yellow key."
   - Keep the coordinate hint for ACTION6 and the note about the 64×64 grid,
     but phrase it simply.

4. **Narration Template (Keep, Slightly Enriched)**
   - Retain the existing "What I see / What it means / Next move" pattern.
   - Lightly tweak wording to nudge toward rule‑centric thinking, e.g.:
     - "What I see" – Describe tiles, colors, shapes, bars, and anything a
       viewer would notice.
     - "What it means" – Call out rules you think are real (e.g., "red seems
       to hurt", "keys of the same color probably open doors").
     - "Next move" – Say whether this is an experiment or part of a plan and
       why you picked it.

5. **Final Report**
   - Still in streamer tone, but with:
     - A short list of rules that seem confirmed.
     - Any tiles or behaviors that are still confusing.
     - What strategies felt strong vs. weak.

This echoes the "Outcome analyzer" and "lessons learned" sections of the
playbook without sounding like a research paper.

---

## Implementation Phases

### Phase 1 – Draft Prompt Text (Docs Only)

- [ ] Draft a concrete, line‑by‑line rewrite of `buildArc3DefaultPrompt()` inline
      in this plan or in an appendix of `ARC3_Agent_Playbook.md`.
- [ ] Keep the Twitch persona and slang light but present; avoid over‑formal
      language.
- [ ] Integrate:
      - Role & mission section.
      - Brain habits bullets.
      - Tool usage & commentary rules.
      - Slightly enriched narration template.
      - Final report guidance.
- [ ] Review with the user for tone and length (ensure it feels simple, not
      academic).

### Phase 2 – Update `buildArc3DefaultPrompt()`

- [ ] Implement the approved prompt text in
      `server/services/arc3/prompts.ts::buildArc3DefaultPrompt()`.
- [ ] Preserve all factual interface details:
      - 16‑color palette mapping.
      - 64×64 grid assumption for coordinates.
      - ACTION1–ACTION6 semantics and warnings.
- [ ] Sanity‑check for any outdated or speculative statements against:
      - `docs/reference/arc3/ARC3.md`.
      - `docs/reference/arc3/ARC3_Integration_Guide.md`.
      - `docs/reference/arc3/ARC3_Agent_Playbook.md`.

### Phase 3 – Light Manual Validation

- [ ] Run a few ARC‑3 playground sessions (ls20 and ft09 at minimum) using the
      new prompt.
- [ ] Observe whether the agent:
      - Talks through tool calls (before and after) as intended.
      - Names tiles and bars and reuses those names.
      - Runs at least a couple of targeted experiments early in a level.
      - States rules explicitly and updates them when surprised.
- [ ] Make small wording tweaks if the behavior is off or if the prompt feels
      too long.

### Phase 4 – Changelog and Long‑Term Maintenance

- [ ] Add a CHANGELOG entry documenting the prompt update and linking back to
      this plan.
- [ ] Update `docs/reference/arc3/ARC3_Agent_Playbook.md` if we discover new
      best‑practice patterns from real game runs.
- [ ] If we later add multiple prompt styles (e.g., "quiet scientist" vs.
      "loud streamer"), extend this plan or add a follow‑up plan describing how
      style selection works in the playground UI.

---

## Success Criteria

1. The ARC‑3 prompt remains short and approachable, still feeling like a Twitch
   streamer talking to chat.
2. The agent reliably:
   - Explains what each tool call is doing and why.
   - Summarizes what changed after each tool call.
   - States rules, tests them, and updates them when surprised.
3. The prompt content stays aligned with
   `docs/reference/arc3/ARC3_Agent_Playbook.md` and other ARC‑3 docs.
4. Future contributors can open this plan to understand *why* the prompt looks
   the way it does before making further changes.
