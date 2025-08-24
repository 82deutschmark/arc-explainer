OpenAIService.ts — prompt-specific issues (short)

Main problems

Dual “system prompt modes”

Multiple paths (ARC vs None) and sometimes concatenating system+user into one user message. This dilutes intent and multiplies test surface.
Fix: Pick one canonical approach; keep system intent separate from user content every time.
No native structured output

You “enforce JSON via prompt” and then do fragile text scraping. That’s prompt bloat and brittle.
Fix: Use response_format with a JSON schema. Let the API enforce structure; remove regex/codeblock scraping language from the prompt.
Prompt builder doesn’t return transport-ready structure

buildAnalysisPrompt returns strings; service re-wraps them ad hoc.
Fix: Have the builder output {instructions, messages, response_format, metadata}. The service should forward as-is, no reformatting.
Hardcoded, model-specific prompt branching

GPT-5 vs o3/o4 paths change the prompt semantics (summary/verbosity), mixing capability logic into prompting.
Fix: Keep prompts model-agnostic; put capability toggles in request fields, not in the prompt text.
Overstuffed system prompt

“Structured system prompt for better parsing” implies instruction payload includes formatting rules, examples, and schema hints.
Fix: Move formatting guarantees to response_format; keep system prompt focused on task and constraints, not JSON rules.
Hidden differences in preview vs live

Preview concatenates differently depending on mode and claims “JSON enforced via prompt”, which is not what live should do.
Fix: Preview must render the exact same fields the transport will send (instructions/messages/response_format), no narrative notes.
Redundant “useStructuredOutput: true”

Flag exists but structure is not enforced by API; it only changes the wording of the prompt.
Fix: Replace with a concrete response_format object returned by the builder.
Prompt defaults encoded in the service

Defaulting systemPromptMode to 'ARC' inside the service couples orchestration and prompt content.
Fix: Make the prompt template (and version) the single source of truth; service only selects templateId.
Reasoning text leaking into prompt design

Prompts likely include directives about “explain steps, then JSON”. You then separately try to capture reasoning via fields.
Fix: Separate concerns: a) task instructions; b) JSON schema; c) optional reasoning controls in request. Don’t ask for explanations in the output when you want strict JSON.
Minimal refactor for prompts

Define ArcAnalysisSchema and export response_format from the prompt module.
Make promptBuilder return:
instructions: string (system intent)
messages: [{role:'user', content:[{type:'text', text: ...}]}]
response_format: { type: 'json_schema', json_schema: { name:'arc_analysis', schema: ArcAnalysisSchema, strict:true } }
Remove “systemPromptMode”. Always send instructions + user message separately.
Delete all JSON-in-prompt phrasing and “useStructuredOutput” flags.
Keep reasoning out of the output format; if desired, add a separate lightweight “reasoning_summary” field in schema and request.reasoning controls.