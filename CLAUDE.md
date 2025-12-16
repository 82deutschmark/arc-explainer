# CLAUDE.md
THE SYMBOLS ✗ and ✔ are forbidden!!!  WE ARE ON WINDOWS AND NEED PROPER UTF-8!!!
Understand state transitions!!!!! ALL controls should elegantly collapse/disappear once an action starts, revealing the live streaming. Never use static lists or bloated components, never do everything at once in one cluttered file!!!
## File Annotation Template (Mandatory)
Every file you create or edit should begin with a basic header like this example:

Author: Your {model name}  (Example: Claude Code using Sonnet 4)
Date: `timestamp`
PURPOSE: VERBOSE DETAILS ABOUT HOW THIS WORKS AND WHAT ELSE IT TOUCHES
SRP/DRY check: Pass/Fail Is this file violating either? Do these things already exist in the project?  Did you look??

Do not be afraid to ask the user questions about the outcomes that they are expecting and be honest about your abilities. If a web search would be useful or updated information, mention that.  The user does not care about the speed at which you execute your tasks. Take your time and ultrathink about a comprehensive plan before you do things. It's generally always a good idea to have your plan approved by the user before you start changing files.

## Role Definition
You are an elite software architect and senior engineer focused on:
- Clean code, modular design, and production-ready implementations
- Strict adherence to SRP and DRY
- Maximizing reuse of modular components and UI (note: repository uses `shadcn/ui`)

## Core Principles
- **Single Responsibility Principle**: Each class/function/module has exactly one reason to change.

- **DRY**: Eliminate duplication via shared utilities/components.
- **Modular Reuse**: Study existing patterns before writing new code.
- **Production Quality**: No mocks, placeholders, or stubs—only production-ready code.
- **Code Quality**: Consistent naming, meaningful variables, robust error handling. NEVER use toy, mock, simulated or stub ANYTHING!!!
-  ## Design & Style Guidelines

VERY IMPORTANT: To avoid what is often referred to as "AI slop", avoid using excessive centered layouts, purple gradients, uniform rounded corners, and Inter font.

## OpenAI Responses API & Conversation State & Agents SDK

- **Never guess the wire format.** When touching any OpenAI/xAI integration, read and follow:
  - `docs/reference/api/ResponsesAPI.md`
  - `docs/reference/api/OpenAI_Responses_API_Streaming_Implementation.md`
  - `docs/reference/api/API_Conversation_Chaining.md`
  - `docs/reference/api/Responses_API_Chain_Storage_Analysis.md`
  - `docs/RESPONSES_GUIDE.md`
  - `docs/reference/api/GPT5_1_Codex_Mini_ARC_Grid_Solver.md` (ARC grid coding agent spec for gpt-5.1-codex-mini)
- **Use `/v1/responses`, not Chat Completions, for reasoning models.** Requests must send an `input` array of role/content items; do not send `messages` to `client.responses.create()`.
- **Reasoning & text config:** For GPT‑5 / o‑series and similar models, prefer:
  - `reasoning.effort` ≥ `medium`,
  - `reasoning.summary` = `detailed`,
  - `text.verbosity` = `high` when streaming so reasoning deltas appear. In some cases, when using Codex models, we may need to fall back to `medium`.
- **Conversation IDs:** Ensure `response.id` flows through as `providerResponseId` and is saved to `explanations.provider_response_id`. For follow‑ups, pass `previousResponseId` from controllers/services through to provider calls as `previous_response_id`.
- **Provider boundaries:** Only reuse a `previousResponseId` when the provider is unchanged (OpenAI→OpenAI, xAI→xAI). Cross‑provider chains must start fresh.
- **Streaming:** Respect the existing two‑step SSE handshake and payload builder in `server/services/openai/payloadBuilder.ts`. Do not change streaming semantics without re‑reading the streaming implementation guide and updating docs/tests.

## Workflow Expectations
1. **Deep Analysis**: Understand existing architecture and reusable pieces before coding.
2. **Plan Architecture**: Clearly define component responsibilities and reuse opportunities.
3. **Implement Modularly**: Compose new logic from existing modules where possible.
4. **Verify Integration**: Use real APIs/services and ensure integrations are correct.

## Output & Documentation Requirements
- Provide architectural explanations, cite SRP/DRY violations you fix, and note reuse decisions.
- Include comprehensive error handling.
- No placeholders or mock data or simulations!!!  
- Maintain `/docs` plans: create `{date}-{plan}-{goal}.md` outlining current objectives and TODOs.

## Development Context
- Solo hobby project with ~4–5 users; apply best practices, but do not over-engineer.
- Testing: run `npm run test`, wait ≥20 seconds to read results, and share a coding joke while waiting.
- Avoid `cd` commands; use Kill Bash (Kill shell: bash_1) to stop dev servers.
- If the user tells you to `git add`/commit with detailed messages for code changes.

## Commands
- `npm run test`: Build and start dev server; wait 10 seconds for startup.
- `npm run db:push`: Apply Drizzle schema changes (tables auto-create on startup if PostgreSQL).

## Error Attribution
Assume:
- Environment variables and secrets are correctly configured.
- External APIs are functional.
- Bugs stem from your code; debug and fix logic/integration issues directly.

## ARC-AGI Scoring & Test Pair Submission Structure (CRITICAL)

**Understanding how submissions are scored** against the official ARC-AGI benchmarking harness:

### Submission JSON Structure
Each submission file (e.g., `1ae2feb7.json`) is a JSON array where **each array element represents ONE test pair**:

```json
[
  {  // Test Pair 0 (array index 0)
    "attempt_1": { "answer": [...], "correct": true, "pair_index": 0, "metadata": {...} },
    "attempt_2": { "answer": [...], "correct": true, "pair_index": 0, "metadata": {...} }
  },
  {  // Test Pair 1 (array index 1)
    "attempt_1": { "answer": [...], "correct": false, "pair_index": 1, "metadata": {...} },
    "attempt_2": { "answer": [...], "correct": true, "pair_index": 1, "metadata": {...} }
  },
  {  // Test Pair 2 (array index 2)
    "attempt_1": { "answer": [...], "correct": true, "pair_index": 2, "metadata": {...} },
    "attempt_2": { "answer": [...], "correct": false, "pair_index": 2, "metadata": {...} }
  }
]
```

### Scoring Logic (from arc-agi-benchmarking repo)
```python
task_score = 0
num_pairs = len(task.test)  # Number of test pairs in the OFFICIAL task definition

for pair_attempts in testing_results:  # Iterate through pairs in submission
    any_attempt_correct = False

    for attempt_data in pair_attempts:  # Check both attempt_1 and attempt_2
        if attempt_data.answer == task.test[pair_index].output:
            any_attempt_correct = True

    if any_attempt_correct:  # If ANY attempt solved the pair
        task_score += 1

score = task_score / num_pairs  # Range: 0.0 to 1.0
```

### Key Insights
1. **Per-pair scoring**: A pair is considered "solved" if **ANY of the 2 attempts** produces correct output
2. **Example**: If attempt_1 solves pairs 0,2 and attempt_2 solves pairs 1,2:
   - Pair 0: attempt_1 ✓ → solved
   - Pair 1: attempt_2 ✓ → solved
   - Pair 2: attempt_1 ✓ OR attempt_2 ✓ → solved (duplicate success doesn't help)
   - **Score: 3/3 = 1.0**

3. **Task pairs count varies**: Some puzzles have 1 test pair, some have 2, some have 3+
4. **Submission structure independent**: Submission can have extra/fewer pairs than official task (extras are skipped by scoring logic)
5. **NOT about attempt counting**: Score is **never** based on "attempt_1 got X correct" as a ratio—only on which pairs are ultimately solved

### Ingestion Implications
- Loop through submission array (not fixed [1,2])
- For each array element (a test pair object):
  - Extract both `attempt_1` and `attempt_2`
  - Validate each against the corresponding test case
  - Mark the pair as solved if either attempt is correct
  - Save both attempts to database (tracking correctness separately)
- Accumulate pair-level scores for final task score = solved_pairs / total_pairs

---

## Handling Revealed Cloaked Models
When a model provider reveals the identity of a previously cloaked/anonymous model, follow this pattern:

### Step 1: Update Model Configuration (`server/config/models.ts`)
- Change `key` from old identifier (when a model is cloaked or in testing or early access!) to new official identifier (e.g., `openrouter/polaris-alpha` → `openai/gpt-5.1`)
- Change `apiModelName` to match the new endpoint name
- Update `name` to display the official model name
- Update pricing, context window, and other specs based on official announcement
- Remove any temporary notes about cloaking

### Step 2: Add Normalization Mapping (`server/utils/modelNormalizer.ts`)
Add a mapping in the `normalizeModelName()` function so existing database entries continue to work:
```typescript
// [Model Name] was revealed to be [Official Name] on [Date]
if (normalized === 'old/model-name' || normalized.startsWith('old/model-name')) {
  normalized = 'new/model-name';
}
```

**Example**: See lines 58-61 for Polaris Alpha → GPT-5.1 mapping, or lines 53-56 for Sonoma-sky → Grok-4-fast mapping.

### Step 3: Update CHANGELOG.md
Add a correct semantic version entry documenting:
- The reveal announcement with date
- Old model identifier → New model identifier
- Updated pricing and specs
- Files changed with line numbers

### Why This Pattern?
- **Preserves data integrity**: Old database entries automatically resolve to new model names via normalization
- **Zero downtime**: No database migration needed
- **Analytics continuity**: Historical data seamlessly merges with new data under the official model name

---

## Architecture Overview

### Monorepo Layout
```
├── client/          # React frontend (Vite + TypeScript)
├── server/          # Express backend (TypeScript, ESM)
├── shared/          # Shared types and schemas
├── data/            # ARC-AGI puzzle datasets
├── solver/          # Saturn Visual Solver (Python)
└── dist/            # Production build output
```

### Frontend (client/)
- Tooling: Vite + TypeScript
- Routing: Wouter
- State: TanStack Query
- UI Components: `shadcn/ui` + TailwindCSS (Check for existing components before creating new ones.)
- Key pages: `PuzzleBrowser`, `PuzzleExaminer`, `ModelDebate` (v2.30.0+), `PuzzleDiscussion` (v3.6.3+), `AnalyticsOverview`, `EloLeaderboard`, `Leaderboards`

Think and breathe Python and TypeScript. You are a Python and TypeScript engineer proficient in building complex, agentic systems or multi-step, stateful execution frameworks.
Work autonomously to develop both clearly defined and ambiguous ideas, including your own, into reality.
Excel at designing and building reliable, high-performance infrastructure that interacts heavily with external, third-party LLMs – some experimental, some large-scale and publicly deployed.
Can architect clean abstractions for complex workflows, specifically synthesizing fragmented information gathered over thousands of parallel, asynchronous queries.
Care deeply about code quality, performance profiling, and building the stable, scalable platform that allows research to run autonomously.

# AGENTS.md

**Author:** The User  (aka YOUR BOSS!!)
**Date:** 2025-10-15  
**Purpose:** Guidance for AI agents working with the ARC Explainer repository. 

Do not be afraid to ask the user questions about the outcomes that they are expecting and be honest about your abilities. If a web search would be useful or updated information, mention that.  The user does not care about the speed at which you execute your tasks. Take your time and ultrathink about a comprehensive plan before you do things. It's generally always a good idea to have your plan approved by the user before you start changing files.

## 📚 Quick Reference – Where to Find Things
- **Core Documentation**
  - README.md – `docs/README.md`
  - DEVELOPER_GUIDE.md – `docs/DEVELOPER_GUIDE.md` (Architecture & onboarding)

- **Reference Materials**
  - **API Documentation** – `docs/reference/api/`
    - EXTERNAL_API.md – `docs/reference/api/EXTERNAL_API.md` (Public REST/SSE APIs)
    - OpenAI_Responses_API_Streaming_Implementation.md – `docs/reference/api/OpenAI_Responses_API_Streaming_Implementation.md`
    - ResponsesAPI.md – `docs/reference/api/ResponsesAPI.md`
    - xAI-API.md – `docs/reference/api/xAI-API.md`
    - API_Conversation_Chaining.md – `docs/reference/api/API_Conversation_Chaining.md`
    - GPT5_1_Codex_Mini_ARC_Grid_Solver.md – `docs/reference/api/GPT5_1_Codex_Mini_ARC_Grid_Solver.md` (ARC coding agent spec)
  - **Architecture** – `docs/reference/architecture/`
  - **Data** – `docs/reference/data/`
  - **Frontend** – `docs/reference/frontend/`
  - **Solvers** – `docs/reference/solvers/`

- **Other Key Areas**
  - HOOKS_REFERENCE.md – `docs/HOOKS_REFERENCE.md` (React hooks cheat-sheet)
  - Backend controllers – `server/controllers/`
  - Domain repositories (SRP compliant) – `server/repositories/`
  - Prompt components – `server/services/prompts/components/`
  - Frontend pages – `client/src/pages/`
  - Reusable UI components – `client/src/components/`
  - Shared TypeScript types – `shared/types.ts`
  - ARC datasets – `data/`
  - Python visual solver – `solver/`

- **Plans and Historical Context**
  - Current plans – `docs/plans/`
  - Old plans – `docs/oldPlans/`

_This directory provides a structured overview of critical docs. For deeper dives, start with the developer guide or specific reference sections._


## 🧠 OpenAI Responses API & Conversation State & AGENTS SDK (CRITICAL) YOUR TRAINING DATA ABOUT THE CHAT COMPLETIONS API IS OUT OF DATE AND NOT RELEVANT TO NEWER LLMS! 

- **Always treat the Responses API docs as source of truth** for OpenAI/xAI calls:
  - `docs/reference/api/ResponsesAPI.md`
  - `docs/reference/api/OpenAI_Responses_API_Streaming_Implementation.md`
  - `docs/reference/api/API_Conversation_Chaining.md`
  - `docs/reference/api/Responses_API_Chain_Storage_Analysis.md`
  - `docs/RESPONSES_GUIDE.md`
- **Endpoint & body shape**
  - Use `/v1/responses` (not Chat Completions) for GPT‑5 / o‑series / Grok‑4 and any direct OpenAI/xAI integration.
  - Requests must use `input` items with `role`/`content` – NEVER `messages` – when calling `/v1/responses`.
- **Reasoning configuration (reasoning models)**
  - Prefer `reasoning.effort` of at least `medium` (often `high`).
  - Use `reasoning.summary` of `detailed` - we expect visible reasoning!!!
  - Set `text.verbosity: "high"` whenever streaming reasoning so deltas actually arrive!!  Only allow high and medium, use medium with Codex 5.1 models.
  - Use generous `max_output_tokens` so internal reasoning does not starve visible text. (Prefer leaving blank!)
- **Conversation state & IDs**
  - Persist `response.id` from providers as `providerResponseId` (see `Responses_API_Chain_Storage_Analysis.md`).
  - Expose `previousResponseId` in our APIs and pass it through to provider calls as `previous_response_id`.
  - Only chain within the **same provider**; OpenAI IDs must not be reused with xAI models (and vice‑versa).
- **Streaming**
  - Keep the two‑step SSE handshake (`/api/stream/analyze` POST then GET) intact; do not invent new patterns.
  - When changing streaming code, match event handling and payload expectations from `OpenAI_Responses_API_Streaming_Implementation.md`.

- Update the changelog with your changes, at the top with proper semantic versioning!!!

## 💬 Communication Guidelines

- Keep messages concise; do not echo chain-of-thought.
- Ask only essential questions not answered in the docs.
- Ask questions if you are unclear about something! But only after you already search all docs!
- On errors: pause, think, and request user input if needed.


## ✍️ Coding Standards

Ideally, every file should start with a basic header like this:

 * Author: {Your Model Name}
 * Date: {timestamp}  
 * PURPOSE: Verbose details about functionality, integration points, dependencies
 * SRP/DRY check: Pass/Fail — did you verify existing functionality?


Additional rules:

- Production-ready only – no mock data or placeholders or simulations or stubs EVER!!!   
- Consistent naming, robust error handling, comment everything.  
- Prefer composition over duplication; always search existing code first.

## 🔧 Workflow & Planning

1. **Deep analysis** – scan existing code for reuse.  
2. **Plan architecture** – create `{date}-{goal}-plan.md` in `docs/` (list files & todos).  
3. **Implement modularly** – follow project patterns and SRP.  
4. **Verify integration** – ensure APIs & dependencies work with real implementations.  
5. **Version control** – in the changelog document every touched file with a brief informative message detailing  
   what/why/how and your model name as author. Use advancing semantic versioning and put your changes at the top!

## 🗄️ Repository Architecture (High-level)

- Monorepo: `client/`, `server/`, `shared/`, `data/`, `solver/`, `dist/`.
- Strict **domain separation** in repositories:
  - `AccuracyRepository` → correctness
  - `TrustworthinessRepository` → HAS A CONFUSING NAME do not make assumptions about its purpose and consult the user.
  - `CostRepository` → cost calculations
  - `MetricsRepository` → aggregation

See `docs/DEVELOPER_GUIDE.md` for full diagrams and table of key files.

## 🛠️ Common Commands

- `npm run test` – build & start dev server (wait 10 s).
- `npm run db:push` – apply Drizzle schema changes.
- **Never** run the dev server automatically; the user controls it.

## 🚫 Prohibited Actions

- No time estimates or premature celebration.
- No shortcuts sacrificing code quality.
- No custom UI when shadcn/ui provides a component.
- No placeholders or mock data or simulations!!!
- No complex explanations or overly technical jargon in your output to the user.  BE BRIEF.  Do not show code or other complex output to the user as a means of explaining your work!!!

---

**Remember:** small hobby project, but quality matters. Think before you code, reuse, and keep things clean.


## STREAMING GUIDE:

- Streaming
The Agents SDK can deliver output from the model and other execution steps incrementally. Streaming keeps your UI responsive and avoids waiting for the entire final result before updating the user.

Enabling streaming
Pass a { stream: true } option to Runner.run() to obtain a streaming object rather than a full result:

Enabling streaming
import { Agent, run } from '@openai/agents';

const agent = new Agent({
  name: 'Storyteller',
  instructions:
    'You are a storyteller. You will be given a topic and you will tell a story about it.',
});

const result = await run(agent, 'Tell me a story about a cat.', {
  stream: true,
});

When streaming is enabled the returned stream implements the AsyncIterable interface. Each yielded event is an object describing what happened within the run. The stream yields one of three event types, each describing a different part of the agent’s execution. Most applications only want the model’s text though, so the stream provides helpers.

Get the text output
Call stream.toTextStream() to obtain a stream of the emitted text. When compatibleWithNodeStreams is true the return value is a regular Node.js Readable. We can pipe it directly into process.stdout or another destination.

Logging out the text as it arrives
import { Agent, run } from '@openai/agents';

const agent = new Agent({
  name: 'Storyteller',
  instructions:
    'You are a storyteller. You will be given a topic and you will tell a story about it.',
});

const result = await run(agent, 'Tell me a story about a cat.', {
  stream: true,
});

result
  .toTextStream({
    compatibleWithNodeStreams: true,
  })
  .pipe(process.stdout);

The promise stream.completed resolves once the run and all pending callbacks are completed. Always await it if you want to ensure there is no more output.

Listen to all events
You can use a for await loop to inspect each event as it arrives. Useful information includes low level model events, any agent switches and SDK specific run information:

Listening to all events
import { Agent, run } from '@openai/agents';

const agent = new Agent({
  name: 'Storyteller',
  instructions:
    'You are a storyteller. You will be given a topic and you will tell a story about it.',
});

const result = await run(agent, 'Tell me a story about a cat.', {
  stream: true,
});

for await (const event of result) {
  // these are the raw events from the model
  if (event.type === 'raw_model_stream_event') {
    console.log(`${event.type} %o`, event.data);
  }
  // agent updated events
  if (event.type === 'agent_updated_stream_event') {
    console.log(`${event.type} %s`, event.agent.name);
  }
  // Agent SDK specific events
  if (event.type === 'run_item_stream_event') {
    console.log(`${event.type} %o`, event.item);
  }
}

See the streamed example for a fully worked script that prints both the plain text stream and the raw event stream.

Event types
The stream yields three different event types:

raw_model_stream_event
type RunRawModelStreamEvent = {
  type: 'raw_model_stream_event';
  data: ResponseStreamEvent;
};

Example:

{
  "type": "raw_model_stream_event",
  "data": {
    "type": "output_text_delta",
    "delta": "Hello"
  }
}

run_item_stream_event
type RunItemStreamEvent = {
  type: 'run_item_stream_event';
  name: RunItemStreamEventName;
  item: RunItem;
};

Example handoff payload:

{
  "type": "run_item_stream_event",
  "name": "handoff_occurred",
  "item": {
    "type": "handoff_call",
    "id": "h1",
    "status": "completed",
    "name": "transfer_to_refund_agent"
  }
}

agent_updated_stream_event
type RunAgentUpdatedStreamEvent = {
  type: 'agent_updated_stream_event';
  agent: Agent<any, any>;
};

Example:

{
  "type": "agent_updated_stream_event",
  "agent": {
    "name": "Refund Agent"
  }
}

Human in the loop while streaming
Streaming is compatible with handoffs that pause execution (for example when a tool requires approval). The interruption field on the stream object exposes the interruptions, and you can continue execution by calling state.approve() or state.reject() for each of them. Executing again with { stream: true } resumes streaming output.

Handling human approval while streaming
import { Agent, run } from '@openai/agents';

const agent = new Agent({
  name: 'Storyteller',
  instructions:
    'You are a storyteller. You will be given a topic and you will tell a story about it.',
});

let stream = await run(
  agent,
  'What is the weather in San Francisco and Oakland?',
  { stream: true },
);
stream.toTextStream({ compatibleWithNodeStreams: true }).pipe(process.stdout);
await stream.completed;

while (stream.interruptions?.length) {
  console.log(
    'Human-in-the-loop: approval required for the following tool calls:',
  );
  const state = stream.state;
  for (const interruption of stream.interruptions) {
    const approved = confirm(
      `Agent ${interruption.agent.name} would like to use the tool ${interruption.rawItem.name} with "${interruption.rawItem.arguments}". Do you approve?`,
    );
    if (approved) {
      state.approve(interruption);
    } else {
      state.reject(interruption);
    }
  }

  // Resume execution with streaming output
  stream = await run(agent, state, { stream: true });
  const textStream = stream.toTextStream({ compatibleWithNodeStreams: true });
  textStream.pipe(process.stdout);
  await stream.completed;
}

A fuller example that interacts with the user is here:

import { z } from 'zod';
import readline from 'node:readline/promises';
import { Agent, run, tool } from '@openai/agents';

// Prompt user for yes/no confirmation
async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await rl.question(`${question} (y/n): `);
  rl.close();
  return ['y', 'yes'].includes(answer.trim().toLowerCase());
}

async function main() {
  // Define a tool that requires approval for certain inputs
  const getWeatherTool = tool({
    name: 'get_weather',
    description: 'Get the weather for a given city',
    parameters: z.object({ city: z.string() }),
    async execute({ city }) {
      return `The weather in ${city} is sunny.`;
    },
  });

  const weatherAgent = new Agent({
    name: 'Weather agent',
    instructions: 'You provide weather information.',
    handoffDescription: 'Handles weather-related queries',
    tools: [getWeatherTool],
  });

  const getTemperatureTool = tool({
    name: 'get_temperature',
    description: 'Get the temperature for a given city',
    parameters: z.object({
      city: z.string(),
    }),
    needsApproval: async (_ctx, { city }) => city.includes('Oakland'),
    execute: async ({ city }) => {
      return `The temperature in ${city} is 20° Celsius`;
    },
  });

  const mainAgent = new Agent({
    name: 'Main agent',
    instructions:
      'You are a general assistant. For weather questions, call the weather agent tool with a short input string and then answer.',
    tools: [
      getTemperatureTool,
      weatherAgent.asTool({
        toolName: 'ask_weather_agent',
        toolDescription:
          'Ask the weather agent about locations by passing a short input.',
        // Require approval when the generated input mentions San Francisco.
        needsApproval: async (_ctx, { input }) =>
          input.includes('San Francisco'),
      }),
    ],
  });

  let stream = await run(
    mainAgent,
    'What is the weather and temperature in San Francisco and Oakland? Use available tools as needed.',
    { stream: true },
  );
  stream.toTextStream({ compatibleWithNodeStreams: true }).pipe(process.stdout);
  await stream.completed;

  while (stream.interruptions?.length) {
    console.log(
      'Human-in-the-loop: approval required for the following tool calls:',
    );
    const state = stream.state;
    for (const interruption of stream.interruptions) {
      const ok = await confirm(
        `Agent ${interruption.agent.name} would like to use the tool ${interruption.rawItem.name} with "${interruption.rawItem.arguments}". Do you approve?`,
      );
      if (ok) {
        state.approve(interruption);
      } else {
        state.reject(interruption);
      }
    }

    // Resume execution with streaming output
    stream = await run(mainAgent, state, { stream: true });
    const textStream = stream.toTextStream({ compatibleWithNodeStreams: true });
    textStream.pipe(process.stdout);
    await stream.completed;
  }

  console.log('\n\nDone');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


Tips
Remember to wait for stream.completed before exiting to ensure all output has been flushed. Keep the stream visible until the user confirms they have read it!
The initial { stream: true } option only applies to the call where it is provided. If you re-run with a RunState you must specify the option again.
If your application only cares about the textual result prefer toTextStream() to avoid dealing with individual event objects.
With streaming and the event system you can integrate an agent into a chat interface, terminal application or any place where users benefit from incremental updates.


Can architect clean abstractions for complex workflows, specifically synthesizing fragmented information gathered over thousands of parallel, asynchronous queries.
Care deeply about code quality, performance profiling, and building the stable, scalable platform that allows research to run autonomously.

## SnakeBench (Greg's external project!)
# Worm 🐛 Arena (Our clone of SnakeBench) Worm 🐛
Greg’s SnakeBench backend (external/SnakeBench/backend). There is already “live” plumbing in Python:

Routes in external/SnakeBench/backend/app.py: /api/games/live and /api/games/<game_id>/live expose in-progress state (pulled from data_access/live_game.py).
The game loop in external/SnakeBench/backend/main.py updates live state every round: after each round it calls data_access.live_game.update_game_state(...) and eventually complete_game(...). It also prints Finished round ... to stdout per round.
Live state is written to the database (see data_access/live_game.py), not streamed over SSE. So a caller can poll these endpoints or DB to watch progress; stdout has per-round prints you could tap if you stream process output.
Implications for us:

Python already emits round-by-round info (stdout prints + DB live_game rows). We can stream by tailing stdout in snakeBenchService.runMatchStreaming and/or polling the Python live endpoints during a match.
No SSE is provided by Python; we’ll need to wrap it on our side (Express) using stdout lines or those live endpoints.
There is live UI in Greg’s frontend (external/SnakeBench/frontend), so the data path is real.

### Worm Arena greatest hits vs local replays (cloud agent notes)

- **DB vs local assets:** Greatest-hits rankings come from the `public.games` table (Railway Postgres). A game can be a "greatest hit" in the DB while **missing** its `snake_game_<id>.json` under `external/SnakeBench/backend/completed_games`.
- **Local-only work:** When you are reasoning about offline replay/MP4 backfill or local analysis, treat `completed_games/` + `completed_games/game_index.json` as the authoritative set of games that actually exist on disk.
- **Analysis helper:** Prefer the Python helper `external/SnakeBench/backend/cli/analyze_local_games.py` when you need to rank local games by cost, rounds, apples (max final score), or duration. It only inspects local JSON files.
- **Docs as source of truth:** For any Worm Arena / SnakeBench reconciliation work, consult `docs/SNAKE_BENCH_DB.md` for schema details and `docs/reference/data/WormArena_GreatestHits_Local_Analysis.md` for the DB vs local replay relationship and example findings.
- **UI & API design:** When exposing "greatest hits" in new endpoints or UI, **separate** the concern of "interesting according to DB" from "playable on this environment". Always filter to games with a known replay asset (local JSON or valid `replay_path`) before promising playback or video generation.

## Best Practices
- Always check CLAUDE.md for detailed guidelines
- Use repository pattern, not direct DB queries
- Maintain SRP and DRY principles
- Real implementations only, no mocks
- Git commit after changes with detailed messages

## Common Issues

- WebSocket issues: Saturn solver streaming can conflict
- Database: Auto-creates tables on startup if PostgreSQL configured

## xAI Grok-4 Structured Outputs (Oct 7, 2025)
- Enabled via Responses API using `response_format.json_schema` (not `text.format`).
- Minimal schema in `server/services/schemas/grokJsonSchema.ts`:
  - required: `multiplePredictedOutputs`, `predictedOutput`
  - optional: `predictedOutput1/2/3`, `confidence`
  - arrays-of-arrays of integers; shallow nesting; `additionalProperties: false`
  - Avoid unsupported constraints: no `minLength/maxLength`, no `minItems/maxItems`, no `allOf`.
- Fallback: on grammar/schema error (400/422/503), auto-retry once without schema; parsing still succeeds via `output_text`.


## OPEN AI Structured Outputs (Oct 14, 2025)
Supported schemas
Structured Outputs supports a subset of the JSON Schema language.

Supported types
The following types are supported for Structured Outputs:

String
Number
Boolean
Integer
Object
Array
Enum
anyOf
Supported properties
In addition to specifying the type of a property, you can specify a selection of additional constraints:

Supported string properties:

pattern — A regular expression that the string must match.
format — Predefined formats for strings. Currently supported:
date-time
time
date
duration
email
hostname
ipv4
ipv6
uuid
Supported number properties:

multipleOf — The number must be a multiple of this value.
maximum — The number must be less than or equal to this value.
exclusiveMaximum — The number must be less than this value.
minimum — The number must be greater than or equal to this value.
exclusiveMinimum — The number must be greater than this value.
Supported array properties:

minItems — The array must have at least this many items.
maxItems — The array must have at most this many items.