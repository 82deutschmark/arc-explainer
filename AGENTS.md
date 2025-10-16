# AGENTS.md

**Author:** The User  
**Date:** 2025-10-15  
**Purpose:** Consolidated guidance for AI agents working with the ARC Explainer repository.  
This version merges the best material from previous guidelines and adds **quick pointers** to locate critical information fast.

---

## 📚 Quick Reference – Where to Find Things

- **Architecture & onboarding** – `docs/DEVELOPER_GUIDE.md`
- **Public REST/SSE APIs** – `docs/EXTERNAL_API.md`
- **React hooks cheat-sheet** – `docs/HOOKS_REFERENCE.md`
- **OpenAI Responses API streaming implementation** – `docs/OpenAI_Responses_API_Streaming_Implementation.md`
- **Backend controllers** – `server/controllers/`
- **Domain repositories (SRP compliant)** – `server/repositories/`
- **Prompt components** – `server/services/prompts/components/`
- **Frontend pages** – `client/src/pages/`
- **Reusable UI components** – `client/src/components/`
- **Shared TypeScript types** – `shared/types.ts`
- **ARC datasets** – `data/`
- **Python visual solver** – `solver/`

_Need a deeper explanation? Start with the developer guide, then follow the paths above._

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

Every TypeScript file **must** start with:

```typescript
/**
 * Author: {Your Model Name}
 * Date: {timestamp}
 * PURPOSE: Verbose details about functionality, integration points, dependencies
 * SRP/DRY check: Pass/Fail — did you verify existing functionality?
 * DaisyUI: Pass/Fail — are you using DaisyUI components instead of custom UI?
 */
```

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