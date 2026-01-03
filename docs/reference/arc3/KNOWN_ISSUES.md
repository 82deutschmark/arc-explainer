# Known Issues with ARC3 Implementation

**Author:** Cascade (ChatGPT 5.1 Codex)  
**Date:** 2026-01-02  
**Status:** CRITICAL – awaiting remediation  

## Summary
Current ARC3 runners (Arc3RealGameRunner and CodexArc3Runner) use the OpenAI Agents SDK, which is unnecessarily complex and expensive for ARC3. The official Claude SDK pattern is simple HTTP calls (scorecard open, RESET/ACTION1-7). Do not extend the existing Agents-based runners; a lightweight Responses API runner is being built.

## Risks
- Higher LLM cost and latency (Agents SDK overhead)
- Duplicate codebases (two runners using the same tech stack)
- Missing ACTION7 (undo)  THIS ACTION IS yet used in any of the games, and it does not need to be included yet. 
- Confusing provider labels (“Claude” vs “Codex” though both are OpenAI)  this may even be confused by the idiot who wrote this plan, because he seems to think Claude is part of OpenAI, which Claude most certainly is not. 

## Temporary Guidance
- Treat current runners as deprecated for new work.
- Use the upcoming `Arc3OpenAIRunner` (Responses API, direct ARC3 HTTP calls) once available.
- Reference audit: `docs/audits/2026-01-02-arc3-implementation-audit.md`.

## Pending Remediation
1. Rename provider labels to `openai_nano` / `openai_codex` (done in UI types).
2. Implement `Arc3OpenAIRunner` (direct Responses API, ACTION1-7).
3. Port helper utilities from `.cache/external/ARC-AGI-3-ClaudeCode-SDK/helpers/`.


