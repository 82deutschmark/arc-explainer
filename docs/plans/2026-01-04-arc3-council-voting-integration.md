# Arc3 Council Voting Integration Plan

**Date:** 2026-01-04  
**Author:** Sonnet 4.5  
**Purpose:** Restore a full three-stage LLM council deliberation loop for ARC3 gameplay. Only one gameplay agent executes actions, but it consults a multi-model council (minimum four advisors + one chairman) for hypotheses, critique, and action selection. This plan aligns with ARC3 reference docs, preprocessing guide, and external agent learnings.

---

## 1. Objectives & Constraints

| Goal | Details |
| --- | --- |
| Multi-LLM Deliberation | Use **4 advisor LLMs + 1 chairman** (default: Claude Haiku 4.5, Gemini 2 Flash Thinking, GPT-5 mini, Grok 4.1 fast; chairman = Claude Sonnet 4.5). Models sourced via OpenRouter, matching `llm-council` patterns. |
| Three-Stage Flow | **Stage 1 (Hypothesis Generation)** → **Stage 2 (Peer Ranking)** → **Stage 3 (Chairman Synthesis)**, identical in spirit to `llm-council` but ARC3-specific. |
| Python Preprocessing | Every council request must include structured arc3_python_preprocessing outputs (objects, deltas, symmetry, change detection, etc.) plus PNG renders per `arc3GridImageService`. |
| Integration Scope | Works with Codex (TS runner), OpenRouter (Python runner), and Haiku harness without duplicating game loops. Council provides advice; agents still act. |
| Performance Guardrails | Council should be optional per run, BYOK-compliant, respect ARC3 rate limits, and degrade gracefully if any model times out. |

---

## 2. High-Level Architecture

```
Gameplay Agent (Codex / OpenRouter / Haiku)
    │ (requests advice)
    ▼
POST /api/arc3-council/prepare              (stage payload with preprocessed frame + metadata)
    │
    ▼
Arc3CouncilStreamService (TS) ─┬─> Stage 1 workers (advisor LLMs)
                               ├─> Stage 2 workers (advisor LLMs, anonymized)
                               └─> Stage 3 chairman (Sonnet 4.5)
    │                                  │
    │ (SSE events: stage start/complete, council.status, council.completed)
    ▼
Gameplay Agent receives recommendations (via SSE or direct call)
    │
    ▼
Agent chooses final action (may follow or override council)
```

Key references:
- [`docs/reference/arc3/ARC3.md`](../reference/arc3/ARC3.md) – canonical action/state spec.
- [`docs/reference/arc3/ARC3_Games.md`](../reference/arc3/ARC3_Games.md) – action semantics applied to council prompts.
- [`docs/2026-01-03-arc3-python-preprocessing-guide.md`](../2026-01-03-arc3-python-preprocessing-guide.md) – preprocessing contract for Stage 1 payloads.
- [`docs/2026-01-03-arc3-agent-external-learnings.md`](../2026-01-03-arc3-agent-external-learnings.md) & [`docs/2026-01-03-external-agents-detailed-analysis.md`](../2026-01-03-external-agents-detailed-analysis.md) – TOMAS (perception/learning/decision) + GuidedRandom heuristics we reuse in the council reasoning narrative.
- [`llm-council/`](../../llm-council) – reference for multi-model orchestration + anonymized ranking.

---

## 3. Detailed Flow (Three Stages)

### 3.1 Payload Preparation (before Stage 1)
1. Gameplay agent captures latest frame bundle (3D grid array, metadata, score, state, available actions, last 5 actions).
2. Python preprocessing (per guide §70–§904):
   - Connected components w/ color naming.
   - Spatial region tagging (9-zone grid).
   - Frame differencing (pixels changed, objects moved/appeared/disappeared).
   - Symmetry/global pattern detection.
   - Navigation vectors (player ↔ objectives) when detectable.
   - Surprise metric (if agent predicted prior result).
3. Render 2D PNG via `arc3GridImageService` (JS) or `render_arc3_frame_to_png` (Python fallback) for vision-capable advisors.
4. Compose `StageContext` JSON:
   ```json
   {
     "game_id": "ls20-fa137e247ce6",
     "turn": 14,
     "score": 120,
     "state": "IN_PROGRESS",
     "available_actions": ["RESET","ACTION1","ACTION2","ACTION5","ACTION6"],
     "action_history": ["RESET","ACTION1","ACTION1","ACTION5"],
     "preprocessing": { ... },     // from Python guide structures
     "frame_image_b64": "iVBORw0KGgo...",
     "council_models": ["anthropic/claude-haiku-4.5", ...],
     "chairman_model": "anthropic/claude-sonnet-4.5"
   }
   ```

### 3.2 Stage 1 – Hypothesis Generation (AISTHESIS analogue)
- **Participants:** All advisor LLMs (default 4).
- **Prompt Inputs:** Preprocessing summary + PNG + ARC3 action spec pulled from docs.
- **Prompt Tasks:**
  1. Describe observed objects, rules, and win hypotheses.
  2. Predict semantics of ACTION1–7 given the scene (tie back to `ARC3_Games.md`).
  3. Propose up to 5 testable hypotheses with confidence, referencing preprocessing evidence (objects moved, symmetry, etc.).
  4. Suggest candidate coordinates for ACTION6 if relevant (0–63 range).
- **Output Schema:**
  ```json
  {
    "model": "google/gemini-2-flash-thinking-exp",
    "hypotheses": [
      {"id":"H1","text":"ACTION1 moves the key up","confidence":0.62,"evidence":["object OBJ_3 shifted -1y"]},
      ...
    ],
    "action_rationale": [{"action":"ACTION5","reason":"Interact with rotator at (18,12)"}],
    "concerns": ["Health dropping 5/turn"]
  }
  ```
- **SSE Events:** `council.stage1_start`, per-model `council.stage1_chunk`, final `council.stage1_complete`.

### 3.3 Stage 2 – Peer Ranking / Cross-Examination (SOPHIA critique)
- **Anonymization:** Label outputs as Set A/B/C/D (shuffle order).
- **Prompt Tasks:**
  - Evaluate each hypothesis set on specificity, evidence, parsimony, and coverage (per user request).
  - Identify contradictions or missing considerations (e.g., ignoring ACTION6).
  - Vote for top 2 hypothesis sets; optionally propose merged rules.
- **Output Schema:**
  ```json
  {
    "model":"openai/gpt-5-mini",
    "ranking":[{"set":"B","score":0.9},{"set":"D","score":0.75}],
    "criticisms":{"Set A":"ignores coordinate action","Set C":"contradicts color change report"},
    "suggested_tests":["ACTION6 at (27,14) to confirm rotator"]
  }
  ```
- **Events:** `council.stage2_start`, `council.stage2_complete` (includes ranking matrix + anonymization map).

### 3.4 Stage 3 – Chairman Synthesis (LOGOS)
- **Inputs:** Raw Stage 1 hypotheses, Stage 2 rankings/criticisms, preprocessing snapshot, ARC3 action/state data.
- **Prompt Requirements:**
  - Summarize consensus top rules and disagreements.
  - Recommend next action (one of 7 actions, ACTION6 may include coords).
  - Provide reasoning referencing hypotheses + rankings + preprocessing evidence.
  - Output confidence (0–1) and fallback plan if action fails.
- **Output Schema:**
  ```json
  {
    "top_rules": [
      {"text":"ACTION1 moves player north reducing health by 5", "confidence":0.82},
      {"text":"Rotator at (18,12) toggles key shape", "confidence":0.71}
    ],
    "suggested_action": {"name":"ACTION5","coordinates":[18,12]},
    "reasoning":"Council consensus favors testing rotator before health depletes.",
    "confidence":0.78,
    "follow_up":"If rotator fails, use ACTION6 on door at (30,8)"
  }
  ```
- **Events:** `council.stage3_start`, `council.stage3_complete`, `council.completed`.

---

## 4. Components & File Work

| Area | Work |
| --- | --- |
| **Backend Routes** | Recreate `/api/arc3-council/prepare`, `/stream/:sessionId`, `/cancel/:sessionId` using SSE (Arc3Codex pattern). Prepare route stores StageContext; stream route orchestrates 3-stage flow. |
| **Services (TS)** | `Arc3CouncilStreamService.ts` (session store, SSE wiring) + `Arc3CouncilOrchestrator.ts` (stage runner). Integrate `arc3GridImageService` + new preprocess payload schema. |
| **Python Helpers** | Optional `server/python/arc3_council_preprocess.py` to reuse object detection/delta logic from `arc3_python_preprocessing`. Ensure output matches StageContext spec. |
| **Model Workers** | Stage 1 & Stage 2 can reuse `llm-council` NDJSON patterns or converge in TS via parallel OpenRouter calls. Stage 3 uses chairman model with structured JSON output. |
| **Agent Integration** | - Codex runner: listen for `council.*` SSE events, show reasoning viewer updates, optionally bias tool choice. <br> - OpenRouter runner: call REST endpoint between turns (since Python already handles NDJSON). <br> - Haiku: use existing SSE input to overlay council notes on observations panel. |
| **Frontend** | Extend `useArc3AgentStream` to subscribe to `council.stage*` events. Add Council panel (tabs: Hypotheses, Rankings, Recommendation). Provide toggle + model selection in each playground config. |
| **Config** | `server/config/arc3Council.ts` storing default advisor roster, chairman, timeout budgets (Stage 1: 12s, Stage 2: 10s, Stage 3: 8s), max tokens, reasoning settings. |

---

## 5. Prompt & Payload Design Notes

1. **Grounding** – All prompts inject a mini-spec excerpt (ARC3 actions table + coordinate rules) so advisors stay consistent.
2. **Preprocessing Attachment** – Provide both JSON summary and PNG to advisors; Stage 2 may omit PNG to save cost.
3. **Token Budgets** – Stage 1 advisors limited to ~900 tokens output; Stage 2 ranking <600 tokens; Stage 3 chairman <700 tokens.
4. **Failure Handling** – If any advisor fails, log `council.stage_error` but continue with remaining votes (minimum quorum = 2).
5. **Rate Limits** – Enforce per-turn cooldown (e.g., only consult council every N turns or when agent requests) to stay under ARC API limits and OpenRouter quotas.
6. **Security/BYOK** – Route must respect environment policy (production requires user-supplied OpenRouter key).

---

## 6. Implementation Phases

1. **Phase A – Foundations (Backend)**
   - Recreate docs from StageContext spec.
   - Implement SSE route + session TTL.
   - Wire Stage 1/2/3 orchestrator with mock advisors (unit tests).

2. **Phase B – Preprocessing & Payload**
   - Integrate Python preprocessing outputs (reuse or import from existing guide implementations).
   - Ensure ACTION6 coordinates validated (0–63) before sending to LLMs.

3. **Phase C – Advisor/Chairman Prompts**
   - Author prompts referencing ARC docs.
   - Implement anonymization + ranking aggregator (use `llm-council` approach).
   - Add logging + metrics (per-stage latency, failures).

4. **Phase D – Agent + Frontend Integration**
   - Hook Codex/OpenRouter/Haiku to optional council toggle.
   - Surface SSE events in UI (council timeline).
   - Provide plan for how agents use recommendations (auto-follow threshold or informational only).

5. **Phase E – QA & Observability**
   - Test on ls20 + ft09 to validate hypotheses quality.
   - Add analytics (per-stage success, average confidence, follow-rate).
   - Update `CHANGELOG.md` + docs references.

---

## 7. Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| Token/Latency blowups | Enforce strict prompt budgets, bail-out timers (Stage 1 12s, Stage 2 10s, Stage 3 8s). |
| Advisor disagreement | Chairman includes tie-break + fallback plan; agent may override if confidence < threshold. |
| Preprocessing drift | Keep preprocessing library versioned (import from `arc3_python_preprocessing` guide). Add schema validation before sending. |
| Cost | Allow per-provider model list (user may drop expensive Grok). Add “light council” mode (2 advisors + chairman) for dev. |
| Agent dependency | Council is advisory; agent must still verify ACTION6 coordinates; manual actions unaffected. |

---

## 8. Success Criteria

1. Council runs complete Stage 1–3 in <35s total with ≥3 advisors participating.
2. Stage outputs reference preprocessing evidence and ARC3 action semantics.
3. Agents can subscribe to `council.*` SSE events and display them in UI timelines.
4. Optional auto-follow threshold (e.g., follow council if confidence ≥0.75) works without breaking existing runs.
5. Documentation updated (plan, integration notes, changelog) and aligned with ARC3 references.

---

## 9. Follow-Up Work (Post-MVP)

- Weighted advisor scores based on historical accuracy.
- Persistent council memory per game (store hypotheses between turns).
- Replay viewer overlay showing council recommendations vs actual actions.
- Council-only playground (manual execution) for human debugging.
- Integration with scorecard analytics (correlate council confidence with win rate).

---

**Next Action:** Implement Phase A foundations, ensuring preprocessing contract and stage orchestration are validated before wiring to gameplay agents.
