# 2025-12-06 – ARC3 prompt doc coverage plan

Goal: align the Arc3 agent system prompt with the official ARC-AGI-3 action docs (simple actions 1-5, complex action 6) so the model receives accurate tool guidance.

Planned steps:
1) Inspect current prompt builder (`server/services/arc3/prompts.ts`) and how it is injected in `Arc3RealGameRunner`.
2) Read official ARC-AGI-3 action references from `https://docs.arcprize.org/llms.txt` (simple actions 1-5, complex action 6; note optional reasoning blob).
3) Rewrite the prompt to embed the validated action guidance (what each action represents, required session fields, response expectations), keep Gen-Z streamer tone, remove placeholders.
4) Update changelog with the change and touchpoints; keep semantic versioning and note files modified.
