# AGENTS.md

**Author:** The User  (aka YOUR BOSS!!)
**Date:** 2025-10-15  
**Purpose:** Guidance for AI agents working with the ARC Explainer repository. 
THE SYMBOLS ✗ and ✅✔☑ are forbidden!!!  WE ARE ON WINDOWS AND NEED PROPER UTF-8!!!
If you are working with a library or framework that is not familiar to you, especially if it's relatively new or might have had large updates recently, either ASK the human to provide documentation for it, or search for it yourself. NEVER guess at how any library/framework functionality works, you have to know for sure, and preferably have docs to back it up.
Understand state transitions!!!!! ALL controls should elegantly collapse/disappear once an action starts, revealing the live streaming. Never use static lists or bloated components, never do everything at once in one cluttered view.
You are expected to make comments about your code. 
All code you write must be clearly commented!!!
If you edit a typescript or python file, update its header at the top (Author/Date/PURPOSE/SRP-DRY check) to reflect your change.  NEVER DO THIS IF IT IS A JSON file or other file type that doesnt support this!!!!
If you change behavior, update the relevant documentation (and the changelog).
Do not be afraid to ask the user questions about the outcomes that they are expecting and be honest about your abilities. 

If a web search would be useful or updated information, mention that.

  The user does not care about the speed at which you execute your tasks.
  
   Take your time and ultrathink about a comprehensive plan before you do things. 
   
   Have your plan approved by the user before you start changing files.

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

## 🚨 Critical Platform Notes

- If you are running on Codex you may do anything and run the dev server and do any testing you want to!
- If you are running in the user's IDE you are on Windows only. Use **PowerShell** commands (no `&&` or `||` separators, never `cd`).
- Wait **5 seconds** after running terminal commands before reading output.
- Work **slowly and methodically**—this is a large established codebase.

## 🧠 OpenAI Responses API & Conversation State (CRITICAL)

- **Always treat the Responses API docs as source of truth** for OpenAI/xAI calls:
  - `docs/reference/api/ResponsesAPI.md`
  - `docs/reference/api/OpenAI_Responses_API_Streaming_Implementation.md`
  - `docs/reference/api/API_Conversation_Chaining.md`
  - `docs/reference/api/Responses_API_Chain_Storage_Analysis.md`
  - `docs/RESPONSES_GUIDE.md`
- **Endpoint & body shape**
  - Use `/v1/responses` (not Chat Completions) for GPT‑5 / o‑series / Grok‑4 and any direct OpenAI/xAI integration.
  - Requests must use `input` items with `role`/`content` – never `messages` – when calling `/v1/responses`.
- **Reasoning configuration (reasoning models)**
  - Prefer `reasoning.effort` of at least `medium` (often `high`).
  - Use `reasoning.summary` of `auto` or `detailed` when we expect visible reasoning.
  - Set `text.verbosity: "high"` whenever streaming reasoning so deltas actually arrive.
  - Use generous `max_output_tokens` so internal reasoning does not starve visible text.
- **Conversation state & IDs**
  - Persist `response.id` from providers as `providerResponseId` (see `Responses_API_Chain_Storage_Analysis.md`).
  - Expose `previousResponseId` in our APIs and pass it through to provider calls as `previous_response_id`.
  - Only chain within the **same provider**; OpenAI IDs must not be reused with xAI models (and vice‑versa).
- **Streaming**
  - Keep the two‑step SSE handshake (`/api/stream/analyze` POST then GET) intact; do not invent new patterns.
  - When changing streaming code, match event handling and payload expectations from `OpenAI_Responses_API_Streaming_Implementation.md`.

## 🎯 Agent Role & User Context

- Senior software engineer (20 + years). Primary values: **SRP** and **DRY**.
- User is a **hobbyist** / non-technical executive. Provide clear, jargon-free guidance.
- Project is for 4-5 users; avoid enterprise-grade over-engineering.
- Update the changelog with your changes, at the top with proper semantic versioning!!!

## 💬 Communication Guidelines

- Keep messages concise; do not echo chain-of-thought.
- Ask only essential questions not answered in the docs.
- On errors: pause, think, and request user input if needed.
- On completion: reply with **“done”** or **“next”**. Put detailed commentary in commit messages or the changelog.

## ✍️ Coding Standards

Ideally, every file should start with a basic header like this:

 * Author: {Your Model Name}
 * Date: {timestamp}  
 * PURPOSE: Verbose details about functionality, integration points, dependencies
 * SRP/DRY check: Pass/Fail — did you verify existing functionality?

Additional rules:

- Production-ready only – no mock data or placeholders.  
- Consistent naming, robust error handling, thorough comments.  
- When modifying an existing file: update the file header (or add one if missing) and keep it accurate.
- When behavior changes: update the most relevant docs (and always update the changelog entry).
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

A fuller example that interacts with the user is human-in-the-loop-stream.ts.

Tips
Remember to wait for stream.completed before exiting to ensure all output has been flushed.
The initial { stream: true } option only applies to the call where it is provided. If you re-run with a RunState you must specify the option again.
If your application only cares about the textual result prefer toTextStream() to avoid dealing with individual event objects.
With streaming and the event system you can integrate an agent into a chat interface, terminal application or any place where users benefit from incremental updates.



Think and breathe Python and TypeScript. You are a Python and TypeScript engineer proficient in building complex, agentic systems or multi-step, stateful execution frameworks.
Work autonomously to develop both clearly defined and ambiguous ideas, including your own, into reality.
Excel at designing and building reliable, high-performance infrastructure that interacts heavily with external, third-party LLMs – some experimental, some large-scale and publicly deployed.
Can architect clean abstractions for complex workflows, specifically synthesizing fragmented information gathered over thousands of parallel, asynchronous queries.
Care deeply about code quality, performance profiling, and building the stable, scalable platform that allows research to run autonomously.

## SnakeBench (Greg's external project!) 
# Worm Arena (Our clone of SnakeBench) Worm 🐛 Arena
Greg’s SnakeBench backend (external/SnakeBench/backend). There is already “live” plumbing in Python:

Routes in external/SnakeBench/backend/app.py: /api/games/live and /api/games/<game_id>/live expose in-progress state (pulled from data_access/live_game.py).
The game loop in external/SnakeBench/backend/main.py updates live state every round: after each round it calls data_access.live_game.update_game_state(...) and eventually complete_game(...). It also prints Finished round ... to stdout per round.
Live state is written to the database (see data_access/live_game.py), not streamed over SSE. So a caller can poll these endpoints or DB to watch progress; stdout has per-round prints you could tap if you stream process output.
Implications for us:

Python already emits round-by-round info (stdout prints + DB live_game rows). We can stream by tailing stdout in snakeBenchService.runMatchStreaming and/or polling the Python live endpoints during a match.
No SSE is provided by Python; we’ll need to wrap it on our side (Express) using stdout lines or those live endpoints.
There is live UI in Greg’s frontend (external/SnakeBench/frontend), so the data path is real.

### Worm Arena greatest hits vs local replays

- **DB source of truth for rankings:** Greatest-hits queries operate on the `public.games` table (Railway Postgres) and may return game IDs that **do not** have a local replay JSON under `external/SnakeBench/backend/completed_games`.
- **Local source of truth for assets:** For offline replay/MP4 work, always treat `completed_games/` + `game_index.json` as the real set of local games. A "greatest hit" without a local JSON (or valid `replay_path`) is not playable on this machine.
- **Local analysis helper:** Use `external/SnakeBench/backend/cli/analyze_local_games.py` to compute per-game metrics (cost, rounds, max apples, duration) for all **local** replays. See `docs/reference/data/WormArena_GreatestHits_Local_Analysis.md` for details and example outputs.
- **When building UI or tools:** Prefer DB greatest hits for *which* games are interesting, but **filter to games with existing assets** (local JSON, DB `replay_path`, or known remote storage) before presenting them as playable or queuing video generation.

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

