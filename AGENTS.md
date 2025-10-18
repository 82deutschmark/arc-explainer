# AGENTS.md

**Author:** The User  
**Date:** 2025-10-15  
**Purpose:** Consolidated guidance for AI agents working with the ARC Explainer repository.  
This version merges the best material from previous guidelines and adds **quick pointers** to locate critical information fast.

---

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

## 🎯 Agent Role & User Context

- Senior software engineer (20 + years). Primary values: **SRP** and **DRY**.
- User is a **hobbyist** / non-technical executive. Provide clear, jargon-free guidance.
- Project is for 4-5 users; avoid enterprise-grade over-engineering.

## 💬 Communication Guidelines

- Keep messages concise; do not echo chain-of-thought.
- Ask only essential questions not answered in the docs.
- On errors: pause, think, and request user input if needed.
- On completion: reply with **“done”** or **“next”**. Put detailed commentary in commit messages.

## ✍️ Coding Standards

Ideally, every TypeScript file should start with a basic header like this:

 * Author: {Your Model Name}
 * Date: {timestamp}  
 * PURPOSE: Verbose details about functionality, integration points, dependencies
 * SRP/DRY check: Pass/Fail — did you verify existing functionality?


Additional rules:

- Production-ready only – no mock data or placeholders.  
- Consistent naming, robust error handling, thorough comments.  
- Prefer composition over duplication; always search existing code first.

## 🔧 Workflow & Planning

1. **Deep analysis** – scan existing code for reuse.  
2. **Plan architecture** – create `{date}-{goal}-plan.md` in `docs/` (list files & todos).  
3. **Implement modularly** – follow project patterns and SRP.  
4. **Verify integration** – ensure APIs & dependencies work with real implementations.  
5. **Version control** – commit every touched file with an informative message detailing  
   what/why/how and your model name as author.

## 🗄️ Repository Architecture (High-level)

- Monorepo: `client/`, `server/`, `shared/`, `data/`, `solver/`, `dist/`.
- Strict **domain separation** in repositories:
  - `AccuracyRepository` → correctness
  - `TrustworthinessRepository` → confidence reliability
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
- No custom UI when DaisyUI provides a component.

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

