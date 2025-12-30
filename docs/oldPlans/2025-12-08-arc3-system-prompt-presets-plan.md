# 2025-12-08 – ARC3 System Prompt Presets & Playbook Default Plan

## Goal

Introduce a small, well-structured library of ARC-AGI-3 agent system prompts and expose them in the ARC3 Agent Playground so operators can:

- **Select between multiple presets** (e.g. Twitch streamer explainer vs. Playbook-style disciplined agent).
- **Use the ARC3 Agent Playbook meta-policy as the default system prompt** across the playground.
- **Run with no base system prompt at all** when desired, relying only on user-provided instructions.

All changes must respect the existing OpenAI Responses API integration and streaming pipeline.

## Scope

- **Backend / server**
  - Extend `server/services/arc3/prompts.ts` to hold multiple named system prompt builders, including the Playbook-based one.
  - Adjust `Arc3RealGameRunner` to:
    - Use the Playbook prompt as the default.
    - Respect an explicit flag for "no default system prompt".
  - Extend ARC3 streaming + non-streaming services and types to pass through preset identifiers and the "skip default" flag.
  - Add lightweight HTTP endpoints for fetching:
    - The default ARC3 system prompt.
    - The list of available system prompt presets (metadata only).

- **Frontend / client**
  - Update `ARC3AgentPlayground.tsx` and `Arc3ConfigurationPanel` to:
    - Fetch preset metadata from the backend.
    - Render a preset dropdown above the System Prompt textarea.
    - Wire the selected preset + "no system prompt" mode into `useArc3AgentStream.start`.

- **Docs & changelog**
  - Document the feature and default behavior in `CHANGELOG.md` (new version at the top).

## Non-goals

- No changes to ARC3 API client behavior (`Arc3ApiClient` remains identical).
- No changes to how frames, scorecards, or manual actions are handled.
- No new UI pages beyond the existing ARC3 Agent Playground.

## Design Overview

### Preset Strategy

Backed by `server/services/arc3/prompts.ts`:

- **Preset IDs** (examples):
  - `twitch_streamer` – existing Twitch-style default prompt.
  - `playbook_meta_policy` – new Playbook-inspired meta-policy prompt (from `ARC3_Agent_Playbook.md` §5).
  - `none` – special mode: no injected base system instructions; instructions come only from the playground textareas.

- Helper exports:
  - `buildArc3DefaultPrompt()` – remains, but internally treated as `twitch_streamer`.
  - `buildArc3PlaybookPrompt()` – new function wrapping the Playbook system-prompt block.
  - `listArc3PromptPresets()` – returns an array of `{ id, label, description, isDefault }`.

### Runner Behavior

In `Arc3RealGameRunner` (`run` and `runWithStreaming`):

- Support new config flags on `Arc3AgentRunConfig`:
  - `systemPrompt?: string;` (already exists).
  - `systemPromptPresetId?: string;` (optional; mainly for tracing/debugging).
  - `skipDefaultSystemPrompt?: boolean;` (exactly implements "no system prompt means no system prompt").

- System prompt selection logic:

  1. If `skipDefaultSystemPrompt === true`:
     - Use `systemPrompt?.trim() || ''`.
     - Do **not** fall back to Twitch or Playbook defaults.

  2. Else (normal mode):
     - If `systemPrompt` is present, use it directly.
     - Otherwise, use the **Playbook prompt** as the default.

- Combine with operator guidance (unchanged pattern):

  - If `instructions` is non-empty: `combinedInstructions = systemPrompt + "\n\nOperator guidance: " + instructions`.
  - If `systemPrompt` is empty and we have guidance, `combinedInstructions` can be just the guidance.

### Streaming & Non-streaming Services

- Extend `StreamArc3Payload` and `ContinueStreamArc3Payload` in `Arc3StreamService.ts` to carry:
  - `systemPromptPresetId?: string;`
  - `skipDefaultSystemPrompt?: boolean;`

- When constructing `Arc3AgentRunConfig` for `runWithStreaming` (and for non-streaming `run`), pass these fields through.

- Keep the existing Responses API usage (previous_response_id, providerResponseId) untouched.

### HTTP Endpoints

Under `server/routes/arc3.ts` (and corresponding controller):

- **GET `/api/arc3/default-prompt`** (already exists):
  - Update implementation so it returns the **Playbook** prompt string as the default.

- **GET `/api/arc3/system-prompts`** (new):
  - Returns metadata only:
    - `[{ id, label, description, isDefault }, ...]`.
  - No full prompt texts, to keep payloads small.

> Optional extension: add `GET /api/arc3/system-prompts/:id` later if the client should fetch exact prompt text per preset instead of embedding it.

## Frontend Changes

### Types & Hook

- Extend `Arc3AgentOptions` in `client/src/hooks/useArc3AgentStream.ts` to include:
  - `systemPromptPresetId?: string;`
  - `skipDefaultSystemPrompt?: boolean;`

- Ensure both streaming (`/api/arc3/stream/prepare`) and non-streaming (`/api/arc3/real-game/run`) requests forward these fields.

### Playground Page

In `ARC3AgentPlayground.tsx`:

- New local state:
  - `systemPromptPresets` – list returned from `/api/arc3/system-prompts`.
  - `systemPromptPresetId` – current selection (`'playbook'` by default).

- On mount:
  - Fetch presets and set `systemPromptPresetId` to the one marked `isDefault` (Playbook).
  - Fetch the default prompt (Playbook) via `/api/arc3/default-prompt` to seed the System Prompt textarea.

- On preset change:
  - For `twitch` or `playbook`, replace the System Prompt textarea with the corresponding template text.
  - For `none`, either:
    - Clear the System Prompt textarea, or
    - Leave it as-is but set `skipDefaultSystemPrompt = true`.

- On `handleStart`:
  - Compute `skipDefaultSystemPrompt = systemPromptPresetId === 'none'`.
  - Call `start({ ..., systemPrompt, instructions, systemPromptPresetId, skipDefaultSystemPrompt })`.

### Configuration Panel

In `Arc3ConfigurationPanel.tsx`:

- Extend props to accept:
  - `systemPromptPresetId` and `setSystemPromptPresetId`.
  - `systemPromptPresets` (metadata).

- Add a small `Select` control above the System Prompt textarea:
  - Options mapped from `systemPromptPresets`.
  - Special label for the `none` preset, e.g. "No base system prompt (custom only)".

- Delegate prompt text updates back up to the page via a callback so that prompt bodies remain centralized.

## Checklist

- [ ] Backend: add Playbook prompt builder and preset registry to `prompts.ts`.
- [ ] Backend: update `Arc3AgentRunConfig` types to include preset id + skip flag.
- [ ] Backend: adjust `Arc3RealGameRunner.run` and `.runWithStreaming` system prompt selection logic.
- [ ] Backend: plumb new fields through `Arc3StreamService` payloads and run config construction.
- [ ] Backend: ensure `/api/arc3/default-prompt` returns Playbook prompt.
- [ ] Backend: implement `/api/arc3/system-prompts` endpoint.
- [ ] Frontend: extend `useArc3AgentStream` options and API payloads.
- [ ] Frontend: fetch and store presets + default prompt in `ARC3AgentPlayground`.
- [ ] Frontend: add preset dropdown to `Arc3ConfigurationPanel` and wire into state.
- [ ] Frontend: ensure "no system prompt" mode truly sets `skipDefaultSystemPrompt = true`.
- [ ] Update `CHANGELOG.md` with new version and brief description of:
  - Playbook as default ARC3 system prompt.
  - New preset dropdown and "no system prompt" behavior.
