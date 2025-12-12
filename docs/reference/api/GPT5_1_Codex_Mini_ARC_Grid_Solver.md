# Using GPT-5.1 Codex Mini with Responses API for ARC Grid Solvers (Stateful, Full Retention)

**Author:** Cascade using Cascade (from user-provided spec)

---

## 1. Scope and assumptions

This spec defines how our **ARC coding agent** should call **OpenAI’s Responses API** with the model **`gpt-5.1-codex-mini`** to write and refine Python programs that solve **ARC (Abstraction and Reasoning Corpus)** grid puzzles.

**Assumptions:**

- We are **NOT** a zero-data-retention (ZDR) system.
- We **WANT** to store all conversations, outputs, and reasoning that OpenAI allows us to store.
- Core task of the agent:
  - “Write and refine a Python program that solves an ARC grid puzzle.”
- All examples and defaults below are tuned for that **ARC-grid coding** scenario.

---

## 2. Model and endpoint

- **Always** use the **Responses API**, **never** Chat Completions.
- **Model name:** `gpt-5.1-codex-mini`.
- All calls MUST go through:
  - SDK: `client.responses.create(...)` (Python, Node, etc.), **or**
  - HTTP: `POST /v1/responses` with the appropriate JSON body.
- Do **not** attempt to use this model via `/v1/chat/completions`; it will not be available there.

---

## 3. Request payload: required, allowed, and forbidden fields

### 3.1 Required / standard fields

- **model**
  - MUST be `"gpt-5.1-codex-mini"` for this agent.

- **instructions**
  - A single string that sets the global behavior for the ARC coding agent.
  - Example (plain language, no code):
    - “You are an ARC puzzle coding assistant. You analyze input and output grids, infer the transformation, and then produce clean, well-commented Python code that maps input grids to output grids.”

- **input**
  - ALWAYS present.
  - Can be either:
    - A single string (simple user content), **or**
    - A list of **message objects**, each with:
      - `role`: `"user"`, `"assistant"`, `"system"`, `"developer"`, or `"tool"`.
      - `content`: string or structured content describing text, grids, or tool outputs.
  - For ARC, user messages typically include:
    - Natural language description of the task.
    - Serialized grids (e.g., JSON arrays or line-based encodings).
    - Constraints (e.g., “No external libraries”, “Only standard Python”, etc.).

- **max_output_tokens**
  - MUST be set for **every** call.
  - For ARC:
    - Planning or analysis turns: use a moderate value (e.g., a few thousand tokens equivalent).
    - Code-generation or refactor turns: higher but still bounded.
  - Exact numeric values are implementation details, but the agent MUST always set a reasonable cap and **NEVER** omit this field.

### 3.2 State and reasoning fields (we ALWAYS use these)

- **store**
  - MUST always be set to `true`.
  - Rationale: we want full server-side state and durable history for every call.

- **previous_response_id**
  - Used for chaining from a previous Responses result.
  - The orchestrator MUST:
    - Persist the `id` of each response we care about.
    - On the next turn in that conversation, set `previous_response_id` to that `id`.
  - This is the **primary mechanism** the agent uses to continue a multi-step ARC coding session.

- **conversation**
  - Optional alternative to `previous_response_id`.
  - If the system chooses to use conversation IDs:
    - It MUST create a conversation once per “ARC session”.
    - All responses for that session MUST carry the same `conversation` ID.
  - For simplicity, choose **ONE** of:
    - (A) `previous_response_id` chaining, or
    - (B) conversation IDs.
  - Do **NOT** mix both methods for the same session.

- **include** (for reasoning)
  - Since we want to store absolutely everything, we MUST:
    - Request all reasoning that the API can return, within policy.
    - Request encrypted reasoning items when available.
  - The exact values depend on current API capabilities, but the agent SHOULD:
    - Include reasoning outputs (e.g., `"reasoning"` items) where allowed.
    - Include encrypted reasoning fields (e.g., `"reasoning.encrypted_content"`) if the API exposes them.
  - The orchestrator MUST persist these reasoning items in our own storage alongside transcripts.

- **metadata** (if supported by SDK/HTTP)
  - The agent SHOULD attach metadata describing:
    - ARC task ID(s).
    - Internal session IDs.
    - Phase (e.g., `"analysis"`, `"code_gen"`, `"refine"`, `"test_result_handling"`).

### 3.3 Fields that MUST NOT be used with GPT-5.1 Codex Mini

For GPT‑5 / GPT‑5.1 reasoning models (including Codex Mini), the following classic tuning fields are **NOT** supported and MUST NEVER be sent:

- `temperature`
- `top_p`
- `logit_bias`
- `stop`
- `presence_penalty`
- `frequency_penalty`

If these are present, the API will reject the request.

Sampling and randomness are controlled internally by the model; rely on **prompt design** and **reasoning controls** instead.

### 3.4 Reasoning controls

We treat **GPT-5.1 Codex Mini** as a reasoning model.

- The agent MUST:
  - Use the reasoning controls that are actually supported (e.g., `reasoning` / `reasoning.effort`).
  - Prefer explicit “planning then coding” workflows in prompts (e.g., tell the model to first reason about ARC grid transformations, then produce the Python code).
- If the API supports a `reasoning.effort` setting (e.g., `"none"`, `"low"`, `"medium"`, `"high"`):
- You must set the verbosity at medium and the summary for detailed.
  - For complex ARC puzzles, the agent SHOULD set a non-default effort level that encourages deeper reasoning, as allowed by the docs.
  - For trivial tasks, lower effort is acceptable.

---

## 4. State and storage strategy (full retention)

### 4.1 General policy

We are **NOT ZDR**. We want **maximum state retention**.

**Rules:**

- Every call MUST have `store: true`.
- We MUST persist:
  - Response IDs.
  - Conversation IDs (if used).
  - Full transcripts (inputs and outputs).
  - All reasoning items and encrypted reasoning content that the API returns.
  - Tool call structures and tool outputs.
- We MUST never intentionally truncate or drop history unless we hit hard technical limits (e.g., context length constraints).

### 4.2 Server-side state (OpenAI)

For each ARC session:

- The first call creates the initial response with `store: true`.
- The orchestrator records its `id`.
- Subsequent calls for that session:
  - Either pass `previous_response_id` equal to the last response `id`, **or**
  - Use a shared `conversation` ID for all calls.

This ensures the model:

- Sees the full prior conversation and reasoning.
- Can build on previous ARC analysis and code, turn after turn.

### 4.3 Client-side state (our system)

For each ARC session, our system MUST store:

- A unique internal session identifier.
- The OpenAI conversation ID or the latest `previous_response_id`.
- The full text of:
  - User prompts (including ARC grids).
  - Model outputs (analysis, plans, code, error reports).
  - Tool outputs (test run results, file reads, etc.).
- All reasoning items that the API returns (including encrypted reasoning fields).

The system MUST also:

- Log each transition:
  - Session state before call.
  - Request payload (minus secrets).
  - Response payload.
- Maintain a complete chronological log of the ARC solving process.

---

## 5. ARC grid coding workflow pattern

### 5.1 Typical interaction phases

**Phase 1: Task ingestion**

- User (human or higher-level agent) sends:
  - ARC task ID.
  - Input and output example grids (training pairs).
  - Any constraints (e.g., time limits, no external libs, target complexity).
- The ARC coding agent calls GPT‑5.1 Codex Mini with:
  - A description of the overall goal, e.g.:
    - “Given these grids, infer the transformation and design a solver that maps any new input grid to its correct output grid.”
  - The grids in a structured format (consistent across all sessions).
  - Clear instructions to:
    - First analyze the pattern.
    - Then describe the transformation in words.
    - Only then plan high-level code structure.

**Phase 2: Design and code generation**

- The agent sends a new call chained with `previous_response_id` or `conversation`:
  - Asks GPT‑5.1 Codex Mini to:
    - Turn the transformation description into Python code.
    - Produce a clean solver (e.g., a single function that takes a grid and returns a grid).
    - Include explanatory comments in the code, if desired.
- The model’s output is:
  - Primarily the Python solver code.
  - Possibly additional explanation or assumptions.

**Phase 3: Execution and testing (with tools)**

- A separate tool (outside of GPT) runs the generated Python code against:
  - The provided ARC training examples.
  - Any hidden validation examples, if available.
- The tool collects:
  - Execution results (pass/fail per example).
  - Error traces or exceptions.
- The agent then calls GPT‑5.1 Codex Mini again with:
  - `previous_response_id` or `conversation`.
  - A `tool` role item that describes:
    - The code that was run (if needed).
    - Test results.
    - Error messages.
    - Examples of where predictions differ from expected outputs.

**Phase 4: Iterative refinement**

- GPT‑5.1 Codex Mini:
  - Reads the test results and error information.
  - Updates its understanding of the ARC transformation.
  - Proposes fixes or a redesigned approach.
  - Produces updated Python code.
- The agent repeats:
  - Tool execution.
  - Reporting results as `tool` role inputs.
  - Chained Responses calls.
- This loop continues until:
  - The solver passes all required ARC examples, **or**
  - A maximum iteration count or budget is reached.

### 5.2 Concrete payload structure expectations (ARC-focused)

For **every** call:

- `model`: `"gpt-5.1-codex-mini"`.
- `instructions`: stable ARC coding role description.
- `input`: structured list of messages such as:
  - `system` / `developer`: high-priority ARC and style guidelines.
  - `user`: current ARC task description and grids.
  - `tool`: test results and diagnostics (for refinement phases).
- `max_output_tokens`: chosen per phase (analysis vs code).
- `store`: `true`.
- `previous_response_id` **or** `conversation`: set to maintain continuity.
- `include`: configured to capture all available reasoning outputs.

---

## 6. Summary of MUST / MUST NOT rules for the agent

### MUST

- Use **Responses API** (not Chat Completions).
- Use model `"gpt-5.1-codex-mini"`.
- Always set `store: true`.
- Always set `max_output_tokens`.
- Use either `previous_response_id` **or** `conversation` for multi-turn ARC sessions.
- Persist:
  - Response IDs.
  - Conversation IDs.
  - Full transcripts.
  - Full reasoning items (including encrypted reasoning).
- Encode ARC grids in a consistent, machine-readable format inside the `input`.
- Use tools (execution, file I/O, etc.) as separate steps, returning results via `tool` role messages.

### MUST NOT

- Send `temperature`, `top_p`, `logit_bias`, `stop`, `presence_penalty`, or `frequency_penalty` for GPT‑5.1 Codex Mini.
- Mix different state mechanisms (e.g., switching ad-hoc between manual transcript sending and ID-based state) within a single ARC session, unless necessary and explicitly managed.
- Drop or discard reasoning items; everything must be stored.

---

## 7. Purpose of this document

This document describes how an orchestrator or agent should call **GPT‑5.1 Codex Mini** via the **Responses API** to build and refine Python solvers for ARC grid puzzles with **full stateful retention** and **no zero-data-retention constraints**.

It complements and depends on the general Responses API references:

- `docs/reference/api/ResponsesAPI.md`
- `docs/reference/api/OpenAI_Responses_API_Streaming_Implementation.md`
- `docs/reference/api/API_Conversation_Chaining.md`
- `docs/reference/api/Responses_API_Chain_Storage_Analysis.md`
- `docs/RESPONSES_GUIDE.md`
