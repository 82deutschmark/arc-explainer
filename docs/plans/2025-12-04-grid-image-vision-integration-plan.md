# 2025-12-04 – Grid Image Vision Integration Plan

## 1. Context and Motivation

ARC Explainer currently:
- Stores puzzles as JSON `ARCTask` objects (`train` / `test` examples with `number[][]` grids).
- Renders grids for humans via React components (`PuzzleGrid`, `GridCell`) using `ARC_COLORS`.
- Sends **only text prompts** to the OpenAI Responses API for puzzle analysis.

We want to:
- Let **vision-capable models** see the actual puzzle grids as **images**, in addition to the textual description.
- Do this in a way that is **backend-centric**, reusable, and does not tie image generation to the React UI or the browser.

This plan covers adding a small server-side image pipeline that:
- Converts `number[][]` grids into PNG images using the same color mapping as the UI.
- Encodes those PNGs as base64 `data:image/png;base64,...` URLs.
- Attaches them as `input_image` entries in the existing **Responses API** calls when a vision model is selected.

## 2. Goals and Non‑Goals

### 2.1 Goals
- **G1 – Server-side rendering from grid arrays**
  - Implement a Node/TypeScript utility to render ARC grids (`number[][]`) to PNG, using the `ARC_COLORS` palette.
- **G2 – Vision model integration**
  - For OpenAI vision-capable models, attach one or more grid images as `input_image` content parts in `/v1/responses` requests.
- **G3 – Backwards compatibility**
  - Preserve current behavior for non-vision models (no images, pure text prompts still work).
- **G4 – API-wide reusability**
  - Keep the grid→image logic provider-agnostic so it can be reused by Saturn, Grover, or future endpoints if needed.

### 2.2 Non‑Goals (for this phase)
- No GIF animation or multi-frame explanations (we may borrow ideas from the Slack GIF creator later, but not implement GIFs now).
- No changes to database schema.
- No major redesign of the React UI; only a simple toggle and/or automatic behavior based on model capability.

## 3. High-Level Design

### 3.1 Where image generation lives

- **Location**: `server/services/gridImageService.ts` (new file).
- **Responsibility**: Convert `number[][]` grids into PNG images and return base64 data URLs.
- **Inputs**:
  - `grid: number[][]` (single grid).
  - Options for cell size, margins, optional grid lines.
- **Outputs**:
  - `{ dataUrl: string; width: number; height: number }` where `dataUrl` is a `data:image/png;base64,...` URL.

This service will:
- Use ARC color tuples from a **shared** module (promoted from `client/src/constants/colors.ts`) so both client and server share a single source of truth for the palette.
- Derive the CSS-friendly `ARC_COLORS` and hex variants from that shared tuple source to keep visuals consistent between Node-rendered images and React-rendered grids.
- Use a Node canvas library (e.g. `canvas` or `@napi-rs/canvas`) added to `package.json`.
- Be pure Node/TS; no coupling to React or the DOM.

### 3.2 Task-level image builder

- Add a small helper (either inside `gridImageService.ts` or a sibling module) that knows how to take an `ARCTask` and create **per-example images**.
- Signature (conceptual):
  - `buildTaskGridImages(task: ARCTask): Promise<GridImagePayload[]>`
- `GridImagePayload` structure (conceptual):
  - `exampleIndex: number`
  - `variant: 'train' | 'test'`
  - `description: string` (e.g. `"Training example 1: input 5×5 → output 3×5"`)
  - `dataUrl: string` (base64 PNG)

Rendering approach for v1:
- For each `ARCExample`:
  - Create a **composite image** with `input` on the left and `output` on the right, separated by a small gap.
  - Labeling will be done textually in the prompt, not drawn into the image.

### 3.3 When images are attached to provider calls

- The decision happens in the **OpenAI service** payload builder:
  - `server/services/openai.ts`
  - `server/services/openai/payloadBuilder.ts` (where the Responses body is constructed).
- Only attach images if **both**:
  - The model is marked as `supportsVision`.
  - The caller sets `includeGridImages: true` via analysis options.

For eligible requests:
- Keep existing system + user text as-is.
- Append a series of `input_text` + `input_image` pairs for the examples, e.g.:
  - `{"type": "input_text", "text": "Training example 1: input → output (see image)."}`
  - `{"type": "input_image", "image_url": dataUrl, "detail": "low"}`

## 4. API Surface and Options

### 4.1 AnalysisOptions extension

File: `server/services/puzzleAnalysisService.ts`

- Extend `AnalysisOptions` with:
  - `includeGridImages?: boolean;`
- Thread this through:
  - `analyzePuzzle(...)` → passes flag into `promptOptions` or `serviceOpts` for the AI service.
  - `analyzePuzzleStreaming(...)` → same for streaming pathway.

Concrete behavior:
- If `includeGridImages` is **true** and model `supportsVision`, the OpenAI payload will include images.
- If `includeGridImages` is **false** or model does not support vision, behavior remains text-only.

### 4.2 Model capability metadata

Files: `server/config/models.ts`, `server/services/openai.ts`, and the existing models API endpoint/controller.

- Treat `server/config/models.ts` as the single source of truth for per-model capabilities, including `supportsVision` (e.g. your recent `supportsVision: true` addition for `gpt-5.1-2025-11-13`).
- Update `getModelInfo(modelKey: string): ModelInfo` in `OpenAIService` to read `supportsVision` from the model config and propagate it into the service-level `ModelInfo` structure.
- Ensure the models API endpoint that returns `ModelConfig[]` includes the `supportsVision` field (it already exists on `ModelConfig` in `shared/types.ts`) so the frontend can consume it directly.
- Update the model-selection hooks/pages (e.g. `PuzzleExaminer`, shared model picker components) to use `supportsVision` from the API response to decide when to enable the “Include puzzle screenshots” toggle and when to send `includeGridImages: true` in outgoing analysis requests.

## 5. Payload Construction Changes

### 5.1 Building image-augmented inputs

File: `server/services/openai/payloadBuilder.ts`

New responsibilities:
1. Accept an optional `gridImages?: GridImagePayload[]` (or derive internally from `task` + flag).
2. If `gridImages` is present and model `supportsVision`:
   - For each image payload:
     - Push an `input_text` item with a concise description.
     - Push an `input_image` item with `image_url` set to the data URL and `detail` set to `'low'` initially (to limit cost), with room to bump to `'high'` later.
3. Keep existing text-only prompt generation intact for backward compatibility.

The final `body` sent to `openAIClient.responses.create/stream` will match the Responses API structure you pasted:
- `model`
- `input: [{ role: 'user', content: [ ...input_text, input_image parts... ] }]`
- `reasoning` block unchanged.

### 5.2 Error handling and safeguards

- If grid rendering fails (e.g. canvas library error):
  - Log an error with puzzle id and model.
  - **Fallback to text-only prompt** rather than failing the analysis.
- Enforce reasonable limits:
  - Cap the number of images per request (e.g. first N train + all test examples, configurable).
  - Optionally expose a max-resolution or `detail` setting later.

## 6. Frontend / UX Hooks

### 6.1 Optional toggle in analysis UI

Files (likely):
- `client/src/pages` where puzzle analysis is configured and launched.

Add a small, low-friction control:
- Label: **“Include puzzle screenshots (vision models only)”**.
- Behavior:
  - Enabled only when selected model has `supportsVision: true`.
  - Sends `includeGridImages: true` to the backend when toggled.

### 6.2 No changes required to `PuzzleGrid` components

- Grid rendering for humans in React (`PuzzleGrid`, `PuzzleGridDisplay`, `PuzzleCard`) remains unchanged.
- The image pipeline operates purely on `number[][]` + `ARC_COLORS` in Node.

## 7. Library and Dependency Changes

- Add a Node canvas library dependency in `package.json`, for example:
  - `@napi-rs/canvas` (fast, prebuilt binaries) **or** `canvas`.
- Keep the image code simple:
  - Filled rectangles in a flat color palette.
  - No fonts or complex drawing for v1.

We will:
- Condition our code to gracefully handle environments where the canvas dependency might fail to load (e.g. log error and fall back to text-only behavior).

## 8. Relationship to Slack GIF Creator

- The Slack GIF creator (`.claude/skills/slack-gif-creator`) is Python-based and focused on:
  - GIF assembly
  - Size validation for Slack limits
  - Animation primitives
- For this plan, we **do not** depend on that code at runtime.
- We conceptually reuse its ideas:
  - Treat each grid image as a “frame” built from simple primitives.
  - Keep color palette small and consistent.
- A **future follow-up** (separate plan) could:
  - Introduce short ARC explanation GIFs using a similar “frame builder” pattern.
  - Either in Node or by integrating a slimmed-down version of the Python toolkit.

## 9. Implementation Steps (Sequenced)

0. **Centralize ARC color palette for client and server**
   - [ ] Move the base `ARC_COLORS_TUPLES` definition into a new shared module (for example `shared/config/colors.ts`) that can be imported from both client and server code.
   - [ ] Refactor `client/src/constants/colors.ts` to import the shared tuples and continue exporting `ARC_COLORS`, `ARC_COLORS_HEX`, etc. for React/UI usage.
   - [ ] Import the shared tuples into `gridImageService.ts` so the Node image pipeline and React UI use the exact same palette without duplicating color data.

1. **Introduce grid image service**
   - [ ] Create `server/services/gridImageService.ts`.
   - [ ] Implement `renderGridToPng(grid: number[][], options): Promise<{ dataUrl, width, height }>`.
   - [ ] Implement `renderExamplePairToPng(input: number[][], output: number[][], options)` for side‑by‑side composites.

2. **Build task-level helper**
   - [ ] Implement `buildTaskGridImages(task: ARCTask): Promise<GridImagePayload[]>` using the grid image service.
   - [ ] Add basic unit tests for a few puzzles to ensure dimensions and colors match expectations.

3. **Extend analysis options and HTTP contracts**
   - [ ] Update `AnalysisOptions` in `puzzleAnalysisService.ts` to include `includeGridImages?: boolean`.
   - [ ] Thread this into `promptOptions` or `serviceOpts` passed to `aiService` methods for both normal and streaming analysis.
   - [ ] Extend `puzzleController.analyze` (and any related DTO/shared request types in `shared/types.ts`) so `includeGridImages` can be accepted in the HTTP request body, forwarded into `AnalysisOptions`, and set by all relevant front-end callers (e.g. `PuzzleExaminer`, `PuzzleDBViewer`, `ProfessionalRefinementUI`).

4. **Mark vision-capable models**
   - [ ] Update `OpenAIService.getModelInfo` and/or model config to set `supportsVision: true` on vision models.
   - [ ] Expose this capability to the frontend model selection UI if not already surfaced.

5. **Modify OpenAI payload builder**
   - [ ] Update `openai/payloadBuilder.ts` to:
     - Accept the `includeGridImages` option and `supportsVision` flag.
     - Call `buildTaskGridImages` when enabled.
     - Append `input_text` + `input_image` parts to the `content` array as `data:image/png;base64,...` URLs.
   - [ ] Ensure streaming and non-streaming paths both use the same payload shape.

6. **Frontend toggle (optional but recommended)**
   - [ ] Add a small toggle in the analysis UI to control `includeGridImages`.
   - [ ] Disable the toggle for models where `supportsVision === false`.

7. **Testing and verification**
   - [ ] Add backend tests that:
     - Confirm text-only behavior is unchanged when `includeGridImages` is false.
     - Confirm Requests built for vision models include `input_image` entries when the flag is true.
   - [ ] Manually run a few analyses with a vision model and verify:
     - The model’s answer looks consistent with “seeing” the grids.
     - Token usage and latency are acceptable.

## 10. Risks and Mitigations

- **R1 – Canvas dependency / environment issues**
  - Mitigation: Catch and log errors when initializing the canvas library; fall back to text-only prompts.
- **R2 – Increased token and latency cost**
  - Mitigation: Use `detail: "low"` initially and restrict the number of images per request.
- **R3 – Payload size limits**
  - Mitigation: Keep images small (e.g. moderate cell sizes, no huge composites) and cap number of examples per request.

## 11. Open Questions for Approval

Before implementing, we should confirm:
1. **Image coverage**:WE NEED IMAGES OF ALL TRAINING EXAMPLES (Input/Output) AND the TEST Input!!!!
2. **Default behavior**: Should `includeGridImages` default to **on** for vision models, or should it be opt‑in via the toggle? OPT IN!!!
3. **Detail level**: Is starting with `detail: "low"` acceptable, or do we want a per-model/per-request configuration for `low` vs `high`?  low is fine!!!
