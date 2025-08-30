---
description: A plan to redesign the educational prompt system for more rigorous, algorithm-driven analysis.
---

# Educational Prompt and System Architecture Redesign Plan

- **Date:** 2025-08-24
- **Author:** Cascade
- **Status:** Proposed

## 1. Problem Statement

The current educational prompt system suffers from several architectural and design flaws that limit its effectiveness for teaching structured problem-solving:

*   **Vague Educational Prompts:** The existing prompts are too generic. They suggest "breaking down patterns" but do not enforce the generation of specific, structured, or multiple algorithmic approaches as requested.
*   **Insufficient JSON Enforcement:** The JSON output schema is not specific enough to support a rigorous educational methodology. It doesn't require the model to produce multiple distinct algorithms for comparison.
*   **Fragmented Architecture:** The system uses multiple, disconnected prompt modes, leading to a fragmented and brittle architecture that is difficult to maintain and extend.
*   **Lack of Algorithmic Rigor:** The core issue is the failure to enforce the generation of multiple, distinct pseudo-code algorithms, which is a key pedagogical goal for teaching advanced problem-solving and computational thinking.

## 2. Proposed Solution

To address these issues, I propose a fundamental redesign focused on a unified, algorithm-driven educational framework.

### 2.1. Unified Prompting Architecture

Instead of multiple fragmented prompt modes, we will consolidate the logic into a more robust and flexible system. This involves:

*   **Refactoring `promptController.ts`:** Create a single, powerful controller that can handle different "strategies" or "lenses" for analysis, with the primary one being the new "Educational Algorithm" strategy.
*   **Consolidating `systemPrompts.ts`:** Define a new, master system prompt for educational analysis that enforces the structured approach outlined below.

### 2.2. New Structured Educational Prompt

The core of the redesign is a new prompt that requires the model to follow a strict, multi-step reasoning process:

1.  **Analyze the Task:** Briefly describe the core transformation required by the ARC puzzle.
2.  **Generate Three Distinct Pseudo-Code Algorithms:** For the core transformation, generate three different algorithms in pseudo-code. Each algorithm must represent a unique approach to solving the problem.
3.  **Evaluate Each Algorithm:** For each of the three algorithms, provide a brief analysis of its potential strengths (pros) and weaknesses (cons).
4.  **Select and Justify:** Select the most promising algorithm from the three and provide a clear justification for the choice.

### 2.3. Strict JSON Output Schema

To enforce the new prompt structure, we will define a new, strict JSON schema for the model's output. This ensures predictable, machine-readable results.

```json
{
  "analysis": "A brief description of the puzzle's core transformation.",
  "algorithms": [
    {
      "id": 1,
      "title": "Algorithm A: [Descriptive Name]",
      "pseudoCode": "...",
      "pros": "...",
      "cons": "..."
    },
    {
      "id": 2,
      "title": "Algorithm B: [Descriptive Name]",
      "pseudoCode": "...",
      "pros": "...",
      "cons": "..."
    },
    {
      "id": 3,
      "title": "Algorithm C: [Descriptive Name]",
      "pseudoCode": "...",
      "pros": "...",
      "cons": "..."
    }
  ],
  "finalSelection": {
    "selectedAlgorithmId": 2,
    "justification": "..."
  }
}
```

## 3. Implementation Steps

1.  **Draft and Finalize Plan:** Review and approve this plan.
2.  **Refactor `systemPrompts.ts`:** Create a new prompt variable, `EDUCATIONAL_ALGORITHMIC_PROMPT`, that instructs the model to follow the new structure and produce the specified JSON output.
3.  **Refactor `promptController.ts`:** Modify the controller to use the new `EDUCATIONAL_ALGORITHMIC_PROMPT`. Implement logic to validate the model's output against the new, stricter JSON schema.
4.  **Update UI (If Necessary):** Assess if the UI needs changes to render the new structured output effectively. This may be a future task.
5.  **Update `Changelog.md`:** Document the new architecture, prompt, and JSON schema.
